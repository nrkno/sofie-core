import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { logger } from '../../logging'
import { Rundown, Rundowns, RundownHoldState } from '../../../lib/collections/Rundowns'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { getCurrentTime, getRandomId, stringifyError } from '../../../lib/lib'
import { loadShowStyleBlueprint } from '../blueprints/cache'
import { RundownEventContext } from '../blueprints/context'
import { setNextPart, onPartHasStoppedPlaying, selectNextPart, LOW_PRIO_DEFER_TIME, resetRundownPlaylist } from './lib'
import { updateStudioTimeline, updateTimeline } from './timeline'
import { IngestActions } from '../ingest/actions'
import { getActiveRundownPlaylistsInStudioFromDb } from '../studio/lib'
import { profiler } from '../profiler'
import { CacheForPlayout, getOrderedSegmentsAndPartsFromPlayoutCache, getSelectedPartInstancesFromCache } from './cache'

export async function activateRundownPlaylist(cache: CacheForPlayout, rehearsal: boolean): Promise<void> {
	logger.info('Activating rundown ' + cache.Playlist.doc._id + (rehearsal ? ' (Rehearsal)' : ''))

	rehearsal = !!rehearsal

	const anyOtherActiveRundowns = await getActiveRundownPlaylistsInStudioFromDb(
		cache.Studio.doc._id,
		cache.Playlist.doc._id
	)
	if (anyOtherActiveRundowns.length) {
		// logger.warn('Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id))
		const otherActiveIds = anyOtherActiveRundowns.map((playlist) => playlist._id)
		throw new Meteor.Error(
			409,
			'Only one rundown can be active at the same time. Active rundown playlists: ' + otherActiveIds,
			JSON.stringify(otherActiveIds)
		)
	}

	if (!cache.Playlist.doc.activationId) {
		// Reset the playlist if it wasnt already active
		await resetRundownPlaylist(cache)
	}

	cache.Playlist.update({
		$set: {
			activationId: getRandomId(),
			rehearsal: rehearsal,
		},
	})

	// Re-Initialize the ActivationCache now when the rundownPlaylist is active
	const rundownsInPlaylist = cache.Rundowns.findFetch()
	await cache.activationCache.initialize(cache.Playlist.doc, rundownsInPlaylist)

	let rundown: Rundown | undefined

	const { currentPartInstance } = getSelectedPartInstancesFromCache(cache)
	if (!currentPartInstance || currentPartInstance.reset) {
		cache.Playlist.update({
			$set: {
				currentPartInstanceId: null,
				nextPartInstanceId: null,
				previousPartInstanceId: null,
			},
		})

		// If we are not playing anything, then regenerate the next part
		const firstPart = selectNextPart(
			cache.Playlist.doc,
			null,
			null,
			getOrderedSegmentsAndPartsFromPlayoutCache(cache)
		)
		await setNextPart(cache, firstPart)
	} else {
		// Otherwise preserve the active partInstances
		const partInstancesToPreserve = new Set(
			_.compact([
				cache.Playlist.doc.nextPartInstanceId,
				cache.Playlist.doc.currentPartInstanceId,
				cache.Playlist.doc.previousPartInstanceId,
			])
		)
		cache.PartInstances.update((p) => partInstancesToPreserve.has(p._id), {
			$set: { playlistActivationId: cache.Playlist.doc.activationId },
		})
		cache.PieceInstances.update((p) => partInstancesToPreserve.has(p.partInstanceId), {
			$set: { playlistActivationId: cache.Playlist.doc.activationId },
		})

		if (cache.Playlist.doc.nextPartInstanceId) {
			const nextPartInstance = cache.PartInstances.findOne(cache.Playlist.doc.nextPartInstanceId)
			if (!nextPartInstance)
				throw new Meteor.Error(
					404,
					`Could not find nextPartInstance "${cache.Playlist.doc.nextPartInstanceId}"`
				)
			rundown = cache.Rundowns.findOne(nextPartInstance.rundownId)
			if (!rundown) throw new Meteor.Error(404, `Could not find rundown "${nextPartInstance.rundownId}"`)
		}
	}

	await updateTimeline(cache)

	cache.defer(async (cache) => {
		if (!rundown) return // if the proper rundown hasn't been found, there's little point doing anything else
		const showStyle = await cache.activationCache.getShowStyleCompound(rundown)
		const { blueprint } = await loadShowStyleBlueprint(showStyle)
		const context = new RundownEventContext(cache.Studio.doc, showStyle, rundown)
		await context.wipeCache()

		try {
			if (blueprint.onRundownActivate) {
				await blueprint.onRundownActivate(context)
			}
		} catch (err) {
			logger.error(`Error in showStyleBlueprint.onRundownActivate: ${stringifyError(err)}`)
		}
	})
}
export async function deactivateRundownPlaylist(cache: CacheForPlayout): Promise<void> {
	const rundown = await deactivateRundownPlaylistInner(cache)

	await updateStudioTimeline(cache)

	cache.defer(async (cache) => {
		if (rundown) {
			const showStyle = await cache.activationCache.getShowStyleCompound(rundown)
			const { blueprint } = await loadShowStyleBlueprint(showStyle)

			const context = new RundownEventContext(cache.Studio.doc, showStyle, rundown)

			try {
				if (blueprint.onRundownDeActivate) {
					await blueprint.onRundownDeActivate(context)
				}
			} catch (err) {
				logger.error(`Error in showStyleBlueprint.onRundownDeActivate: ${stringifyError(err)}`)
			}

			context.wipeCache().catch(logger.error)
		}
	})
}
export async function deactivateRundownPlaylistInner(cache: CacheForPlayout): Promise<Rundown | undefined> {
	const span = profiler.startSpan('deactivateRundownPlaylistInner')
	logger.info(`Deactivating rundown playlist "${cache.Playlist.doc._id}"`)

	const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache)

	let rundown: Rundown | undefined
	if (currentPartInstance) {
		rundown = cache.Rundowns.findOne(currentPartInstance.rundownId)

		// defer so that an error won't prevent deactivate
		cache.deferAfterSave(() => {
			// Run in the background, we don't want to hold onto the lock to do this
			Meteor.setTimeout(() => {
				const currentRundown = Rundowns.findOne(currentPartInstance.rundownId)

				if (currentRundown) {
					IngestActions.notifyCurrentPlayingPart(currentRundown, null)
				} else {
					logger.error(
						`Could not find owner Rundown "${currentPartInstance.rundownId}" of PartInstance "${currentPartInstance._id}"`
					)
				}
			}, LOW_PRIO_DEFER_TIME)
		})
	} else if (nextPartInstance) {
		rundown = cache.Rundowns.findOne(nextPartInstance.rundownId)
	}

	if (currentPartInstance) onPartHasStoppedPlaying(cache, currentPartInstance, getCurrentTime())

	cache.Playlist.update({
		$set: {
			previousPartInstanceId: null,
			currentPartInstanceId: null,
			holdState: RundownHoldState.NONE,
			nextSegmentId: undefined,
		},
		$unset: {
			activationId: 1,
			nextSegmentId: 1,
		},
	})
	await setNextPart(cache, null)

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
export async function prepareStudioForBroadcast(cache: CacheForPlayout, okToDestoryStuff: boolean): Promise<void> {
	const rundownPlaylistToBeActivated = cache.Playlist.doc
	logger.info('prepareStudioForBroadcast ' + cache.Studio.doc._id)

	const playoutDevices = cache.PeripheralDevices.findFetch((p) => p.type === PeripheralDeviceAPI.DeviceType.PLAYOUT)

	for (const device of playoutDevices) {
		// Fire the command and don't wait for the result
		PeripheralDeviceAPI.executeFunction(
			device._id,
			'devicesMakeReady',
			okToDestoryStuff,
			rundownPlaylistToBeActivated._id
		)
			.then(() => {
				logger.info(`devicesMakeReady: "${device._id}" OK`)
			})
			.catch((err) => {
				logger.error(`devicesMakeReady: "${device._id} Fail: ${stringifyError(err)}"`)
			})
	}
}
/**
 * Makes a studio "stand down" after a broadcast
 * @param studio
 * @param okToDestoryStuff true if we're not ON AIR, things might flicker on the output
 */
export async function standDownStudio(cache: CacheForPlayout, okToDestoryStuff: boolean): Promise<void> {
	logger.info('standDownStudio ' + cache.Studio.doc._id)

	const playoutDevices = cache.PeripheralDevices.findFetch((p) => p.type === PeripheralDeviceAPI.DeviceType.PLAYOUT)

	for (const device of playoutDevices) {
		// Fire the command and don't wait for the result
		PeripheralDeviceAPI.executeFunction(device._id, 'devicesStandDown', okToDestoryStuff)
			.then(() => {
				logger.info(`devicesStandDown: "${device._id}" OK`)
			})
			.catch((err) => {
				logger.error(`devicesStandDown: "${device._id} Fail: ${stringifyError(err)}"`)
			})
	}
}
