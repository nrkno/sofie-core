import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { logger } from '../../logging'
import { Rundown, Rundowns, RundownHoldState } from '../../../lib/collections/Rundowns'
import { PeripheralDevices, PeripheralDevice } from '../../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { getCurrentTime, getRandomId, waitForPromise } from '../../../lib/lib'
import { loadShowStyleBlueprint } from '../blueprints/cache'
import { RundownContext } from '../blueprints/context'
import {
	setNextPart,
	onPartHasStoppedPlaying,
	selectNextPart,
	getSelectedPartInstancesFromCache,
	getAllOrderedPartsFromPlayoutCache,
} from './lib'
import { updateTimeline } from './timeline'
import { IngestActions } from '../ingest/actions'
import { getActiveRundownPlaylistsInStudioFromDb } from './studio'
import { CacheForPlayout, CacheForStudio } from '../../cache/DatabaseCaches'
import { profiler } from '../profiler'

export function activateRundownPlaylist(cache: CacheForPlayout, rehearsal: boolean): void {
	{
		const playlist = cache.Playlist.doc
		logger.info('Activating rundown ' + playlist._id + (rehearsal ? ' (Rehearsal)' : ''))

		rehearsal = !!rehearsal
		// if (rundown.active && !rundown.rehearsal) throw new Meteor.Error(403, `Rundown "${rundown._id}" is active and not in rehersal, cannot reactivate!`)

		const studio = cache.Studio.doc

		const anyOtherActiveRundowns = getActiveRundownPlaylistsInStudioFromDb(studio._id, playlist._id)

		if (anyOtherActiveRundowns.length) {
			// logger.warn('Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id))
			throw new Meteor.Error(
				409,
				'Only one rundown can be active at the same time. Active rundown playlists: ' +
					_.map(anyOtherActiveRundowns, (playlist) => playlist._id),
				JSON.stringify(_.map(anyOtherActiveRundowns, (playlist) => playlist._id))
			)
		}

		cache.Playlist.update({
			$set: {
				active: true,
				rehearsal: rehearsal,
				activeInstanceId: getRandomId(),
			},
		})
	}

	const activePlaylist = cache.Playlist.doc

	// Re-Initialize the ActivationCache now when the rundownPlaylist is active
	const rundownsInPlaylist = cache.Rundowns.findFetch()
	waitForPromise(cache.activationCache.initialize(activePlaylist, rundownsInPlaylist))

	if (!activePlaylist.nextPartInstanceId) {
		const firstPart = selectNextPart(activePlaylist, null, getAllOrderedPartsFromPlayoutCache(cache))
		setNextPart(cache, firstPart ? firstPart.part : null)
	} else {
		const nextPartInstance = cache.PartInstances.findOne(activePlaylist.nextPartInstanceId)
		if (!nextPartInstance)
			throw new Meteor.Error(404, `Could not find nextPartInstance "${activePlaylist.nextPartInstanceId}"`)
		const rundown = cache.Rundowns.findOne(nextPartInstance.rundownId)
		if (!rundown) throw new Meteor.Error(404, `Could not find rundown "${nextPartInstance.rundownId}"`)

		cache.defer(() => {
			if (!rundown) return // if the proper rundown hasn't been found, there's little point doing anything else
			const showStyleCompound = waitForPromise(cache.activationCache.getShowStyleCompound(rundown))
			const { blueprint } = loadShowStyleBlueprint(showStyleCompound)

			const context = new RundownContext(cache.Studio.doc, rundown, showStyleCompound, undefined)
			context.wipeCache()

			if (blueprint.onRundownActivate) {
				Promise.resolve(blueprint.onRundownActivate(context)).catch(logger.error)
			}
		})
	}

	updateTimeline(cache)
}
export function deactivateRundownPlaylist(cache: CacheForPlayout): void {
	const rundown = deactivateRundownPlaylistInner(cache)

	updateTimeline(cache)

	cache.defer(() => {
		if (rundown) {
			const showStyleBase = waitForPromise(cache.activationCache.getShowStyleCompound(rundown))
			const { blueprint } = loadShowStyleBlueprint(showStyleBase)

			if (blueprint.onRundownDeActivate) {
				const context = new RundownContext(cache.Studio.doc, rundown, showStyleBase, undefined)
				Promise.resolve(blueprint.onRundownDeActivate(context)).catch(logger.error)
			}
		}
	})
}
export function deactivateRundownPlaylistInner(cache: CacheForPlayout): Rundown | undefined {
	const span = profiler.startSpan('deactivateRundownPlaylistInner')
	logger.info(`Deactivating rundown playlist "${cache.Playlist.doc._id}"`)

	const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache)

	let rundown: Rundown | undefined
	if (currentPartInstance) {
		rundown = cache.Rundowns.findOne(currentPartInstance.rundownId)
		// defer so that an error won't prevent deactivate
		cache.deferAfterSave(() => {
			// This is low-prio, deferring
			Meteor.setTimeout(() => {
				if (rundown) {
					IngestActions.notifyCurrentPlayingPart(rundown, null)
				} else {
					logger.error(
						`Could not find owner Rundown "${currentPartInstance.rundownId}" of PartInstance "${currentPartInstance._id}"`
					)
				}
			}, LOW_PRIO_DEFER_TIME)
		})
	} else {
		if (nextPartInstance) {
			rundown = cache.Rundowns.findOne(nextPartInstance.rundownId)
		}
	}

	if (currentPartInstance) onPartHasStoppedPlaying(cache, currentPartInstance, getCurrentTime())

	cache.Playlist.update({
		$set: {
			active: false,
			previousPartInstanceId: null,
			currentPartInstanceId: null,
			holdState: RundownHoldState.NONE,
		},
	})
	setNextPart(cache, null)

	if (currentPartInstance) {
		cache.PartInstances.update(currentPartInstance._id, {
			$set: {
				'timings.takeOut': getCurrentTime(),
			},
		})
	}
	if (span) span.end()
	return rundown
}
/**
 * Prepares studio before a broadcast is about to start
 * @param studio
 * @param okToDestoryStuff true if we're not ON AIR, things might flicker on the output
 */
export function prepareStudioForBroadcast(cache: CacheForPlayout, okToDestoryStuff: boolean): void {
	const rundownPlaylistToBeActivated = cache.Playlist.doc
	if (!rundownPlaylistToBeActivated.studioId)
		throw new Meteor.Error(500, `Playlist "${rundownPlaylistToBeActivated._id}" has no studioId!`)

	logger.info('prepareStudioForBroadcast ' + rundownPlaylistToBeActivated.studioId)

	const playoutDevices: Array<Pick<PeripheralDevice, '_id'>> = PeripheralDevices.find(
		{
			studioId: rundownPlaylistToBeActivated.studioId,
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
		},
		{
			fields: { _id: 1 },
		}
	).fetch()

	_.each(playoutDevices, (device: PeripheralDevice) => {
		PeripheralDeviceAPI.executeFunction(
			device._id,
			(err) => {
				if (err) {
					logger.error(err)
				} else {
					logger.info('devicesMakeReady OK')
				}
			},
			'devicesMakeReady',
			okToDestoryStuff,
			rundownPlaylistToBeActivated._id
		)
	})
}
/**
 * Makes a studio "stand down" after a broadcast
 * @param studio
 * @param okToDestoryStuff true if we're not ON AIR, things might flicker on the output
 */
export function standDownStudio(cache: CacheForPlayout | CacheForStudio, okToDestoryStuff: boolean): void {
	const studio = cache.Studio.doc
	logger.info('standDownStudio ' + studio._id)

	const playoutDevices: Array<Pick<PeripheralDevice, '_id'>> = PeripheralDevices.find(
		{
			studioId: studio._id,
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
		},
		{
			fields: { _id: 1 },
		}
	).fetch()

	_.each(playoutDevices, (device: PeripheralDevice) => {
		PeripheralDeviceAPI.executeFunction(
			device._id,
			(err) => {
				if (err) {
					logger.error(err)
				} else {
					logger.info('devicesStandDown OK')
				}
			},
			'devicesStandDown',
			okToDestoryStuff
		)
	})
}
