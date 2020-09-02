import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { logger } from '../../logging'
import { Rundown, Rundowns, RundownHoldState } from '../../../lib/collections/Rundowns'
import { Studio } from '../../../lib/collections/Studios'
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
	getAllOrderedPartsFromCache,
} from './lib'
import { updateTimeline } from './timeline'
import { IngestActions } from '../ingest/actions'
import { getActiveRundownPlaylistsInStudio } from './studio'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { CacheForRundownPlaylist, CacheForPlayout } from '../../DatabaseCaches'
import { profiler } from '../profiler'

export function activateRundownPlaylist(cache: CacheForPlayout, rehearsal: boolean): void {
	{
		const playlist = cache.Playlist.doc
		logger.info('Activating rundown ' + playlist._id + (rehearsal ? ' (Rehearsal)' : ''))

		rehearsal = !!rehearsal
		// if (rundown.active && !rundown.rehearsal) throw new Meteor.Error(403, `Rundown "${rundown._id}" is active and not in rehersal, cannot reactivate!`)

		const studio = cache.Studio.doc

		const anyOtherActiveRundowns = getActiveRundownPlaylistsInStudio(null, studio._id, playlist._id)

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
	cache.activationCache.initialize(activePlaylist, rundownsInPlaylist)

	let rundown: Rundown | undefined

	if (!activePlaylist.nextPartInstanceId) {
		const firstPart = selectNextPart(activePlaylist, null, getAllOrderedPartsFromCache(cache))
		setNextPart(cache, firstPart ? firstPart.part : null)
	} else {
		const nextPartInstance = cache.PartInstances.findOne(rundownPlaylist.nextPartInstanceId)
		if (!nextPartInstance)
			throw new Meteor.Error(404, `Could not find nextPartInstance "${rundownPlaylist.nextPartInstanceId}"`)
		rundown = cache.Rundowns.findOne(nextPartInstance.rundownId)
		if (!rundown) throw new Meteor.Error(404, `Could not find rundown "${nextPartInstance.rundownId}"`)
	}

	updateTimeline(cache, studio._id)

	cache.defer(() => {
		if (!rundown) return // if the proper rundown hasn't been found, there's little point doing anything else
		const { blueprint } = loadShowStyleBlueprint(waitForPromise(cache.activationCache.getShowStyleBase(rundown)))
		const context = new RundownContext(rundown, cache, undefined)
		context.wipeCache()
		if (blueprint.onRundownActivate) {
			Promise.resolve(blueprint.onRundownActivate(context)).catch(logger.error)
		}
	})
}
export function deactivateRundownPlaylist(cache: CacheForPlayout): void {
	const rundown = deactivateRundownPlaylistInner(cache)

	updateTimeline(cache, rundownPlaylist.studioId)

	cache.defer((cache) => {
		if (rundown) {
			const { blueprint } = loadShowStyleBlueprint(
				waitForPromise(cache.activationCache.getShowStyleBase(rundown))
			)
			if (blueprint.onRundownDeActivate) {
				Promise.resolve(blueprint.onRundownDeActivate(new RundownContext(rundown, cache, undefined))).catch(
					logger.error
				)
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
		// defer so that an error won't prevent deactivate
		Meteor.setTimeout(() => {
			rundown = Rundowns.findOne(currentPartInstance.rundownId)

			if (rundown) {
				IngestActions.notifyCurrentPlayingPart(rundown, null)
			} else {
				logger.error(
					`Could not find owner Rundown "${currentPartInstance.rundownId}" of PartInstance "${currentPartInstance._id}"`
				)
			}
		}, 40)
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
			$push: {
				'part.timings.takeOut': getCurrentTime(),
			},
		})

		// TODO-PartInstance - pending new data flow
		cache.Parts.update(currentPartInstance.part._id, {
			$push: {
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
export function prepareStudioForBroadcast(
	okToDestoryStuff: boolean,
	rundownPlaylistToBeActivated: RundownPlaylist
): void {
	if (!rundownPlaylistToBeActivated.studioId)
		throw new Meteor.Error(500, `Playlist "${rundownPlaylistToBeActivated._id}" has no studioId!`)
	logger.info('prepareStudioForBroadcast ' + rundownPlaylistToBeActivated.studioId)

	let playoutDevices = PeripheralDevices.find({
		studioId: rundownPlaylistToBeActivated.studioId,
		type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
	}).fetch()

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
export function standDownStudio(cache: CacheForRundownPlaylist, studio: Studio, okToDestoryStuff: boolean): void {
	logger.info('standDownStudio ' + studio._id)

	let playoutDevices = waitForPromise(cache.activationCache.getPeripheralDevices()).filter(
		(d) => d.type === PeripheralDeviceAPI.DeviceType.PLAYOUT
	)

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
