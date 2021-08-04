import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { getActiveRundownPlaylistsInStudioFromDb } from '../studio/lib'
import _ = require('underscore')
import { JobContext } from '../jobs'
import { logger } from '../logging'
import { CacheForPlayout, getOrderedSegmentsAndPartsFromPlayoutCache, getSelectedPartInstancesFromCache } from './cache'
import { onPartHasStoppedPlaying, resetRundownPlaylist, selectNextPart, setNextPart } from './lib'
import { updateStudioTimeline, updateTimeline } from './timeline'
import { RundownEventContext } from '../blueprints/context'
import { getCurrentTime } from '../lib'
import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'

export async function activateRundownPlaylist(
	context: JobContext,
	cache: CacheForPlayout,
	rehearsal: boolean
): Promise<void> {
	logger.info('Activating rundown ' + cache.Playlist.doc._id + (rehearsal ? ' (Rehearsal)' : ''))

	rehearsal = !!rehearsal
	// if (rundown.active && !rundown.rehearsal) throw new Meteor.Error(403, `Rundown "${rundown._id}" is active and not in rehersal, cannot reactivate!`)

	const anyOtherActiveRundowns = await getActiveRundownPlaylistsInStudioFromDb(
		context,
		cache.Studio.doc._id,
		cache.Playlist.doc._id
	)
	if (anyOtherActiveRundowns.length) {
		// logger.warn('Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id))
		const otherActiveIds = anyOtherActiveRundowns.map((playlist) => playlist._id)
		throw new Error(
			'Only one rundown can be active at the same time. Active rundown playlists: ' +
				JSON.stringify(otherActiveIds)
		)
	}

	if (!cache.Playlist.doc.activationId) {
		// Reset the playlist if it wasnt already active
		await resetRundownPlaylist(context, cache)
	}

	cache.Playlist.update({
		$set: {
			activationId: getRandomId(),
			rehearsal: rehearsal,
		},
	})

	// Re-Initialize the ActivationCache now when the rundownPlaylist is active
	// const rundownsInPlaylist = cache.Rundowns.findFetch({})
	// await cache.activationCache.initialize(cache.Playlist.doc, rundownsInPlaylist)

	let rundown: DBRundown | undefined

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
			context,
			cache.Playlist.doc,
			null,
			getOrderedSegmentsAndPartsFromPlayoutCache(cache)
		)
		await setNextPart(context, cache, firstPart)
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
				throw new Error(`Could not find nextPartInstance "${cache.Playlist.doc.nextPartInstanceId}"`)
			rundown = cache.Rundowns.findOne(nextPartInstance.rundownId)
			if (!rundown) throw new Error(`Could not find rundown "${nextPartInstance.rundownId}"`)
		}
	}

	await updateTimeline(context, cache)

	cache.defer(async (cache) => {
		if (!rundown) return // if the proper rundown hasn't been found, there's little point doing anything else
		const showStyle = await context.getShowStyleCompound(rundown.showStyleVariantId, rundown.showStyleVariantId)
		const blueprint = await context.getShowStyleBlueprint(showStyle._id)
		const context2 = new RundownEventContext(
			cache.Studio.doc,
			context.getStudioBlueprintConfig(),
			showStyle,
			context.getShowStyleBlueprintConfig(showStyle),
			rundown
		)
		if (blueprint.blueprint.onRundownActivate) {
			Promise.resolve(blueprint.blueprint.onRundownActivate(context2)).catch(logger.error)
		}
	})
}
export async function deactivateRundownPlaylist(context: JobContext, cache: CacheForPlayout): Promise<void> {
	const rundown = await deactivateRundownPlaylistInner(context, cache)

	await updateStudioTimeline(context, cache)

	cache.defer(async (cache) => {
		if (rundown) {
			const showStyle = await context.getShowStyleCompound(rundown.showStyleVariantId, rundown.showStyleBaseId)
			const blueprint = await context.getShowStyleBlueprint(showStyle._id)
			if (blueprint.blueprint.onRundownDeActivate) {
				const context2 = new RundownEventContext(
					cache.Studio.doc,
					context.getStudioBlueprintConfig(),
					showStyle,
					context.getShowStyleBlueprintConfig(showStyle),
					rundown
				)
				Promise.resolve(blueprint.blueprint.onRundownDeActivate(context2)).catch(logger.error)
			}
		}
	})
}
export async function deactivateRundownPlaylistInner(
	context: JobContext,
	cache: CacheForPlayout
): Promise<DBRundown | undefined> {
	const span = context.startSpan('deactivateRundownPlaylistInner')
	logger.info(`Deactivating rundown playlist "${cache.Playlist.doc._id}"`)

	const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache)

	let rundown: DBRundown | undefined
	if (currentPartInstance) {
		rundown = cache.Rundowns.findOne(currentPartInstance.rundownId)

		// TODO - queue this task:

		// // defer so that an error won't prevent deactivate
		// cache.deferAfterSave(() => {
		// 	// Run in the background, we don't want to hold onto the lock to do this
		// 	Meteor.setTimeout(() => {
		// 		const currentRundown = Rundowns.findOne(currentPartInstance.rundownId)

		// 		if (currentRundown) {
		// 			IngestActions.notifyCurrentPlayingPart(currentRundown, null)
		// 		} else {
		// 			logger.error(
		// 				`Could not find owner Rundown "${currentPartInstance.rundownId}" of PartInstance "${currentPartInstance._id}"`
		// 			)
		// 		}
		// 	}, LOW_PRIO_DEFER_TIME)
		// })
	} else if (nextPartInstance) {
		rundown = cache.Rundowns.findOne(nextPartInstance.rundownId)
	}

	if (currentPartInstance) onPartHasStoppedPlaying(cache, currentPartInstance, getCurrentTime())

	cache.Playlist.update({
		$set: {
			previousPartInstanceId: null,
			currentPartInstanceId: null,
			holdState: RundownHoldState.NONE,
		},
		$unset: {
			activationId: 1,
		},
	})
	await setNextPart(context, cache, null)

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
export async function prepareStudioForBroadcast(cache: CacheForPlayout, _okToDestoryStuff: boolean): Promise<void> {
	// const rundownPlaylistToBeActivated = cache.Playlist.doc
	logger.info('prepareStudioForBroadcast ' + cache.Studio.doc._id)

	// TODO - need to fire some 'DDP commands'

	// const playoutDevices = cache.PeripheralDevices.findFetch((p) => p.type === PeripheralDeviceType.PLAYOUT)

	// await Promise.allSettled(
	// 	playoutDevices.map(async (device) =>
	// 		makePromise(() => {
	// 			PeripheralDeviceAPI.executeFunction(
	// 				device._id,
	// 				(err) => {
	// 					if (err) {
	// 						logger.error(err)
	// 					} else {
	// 						logger.info('devicesMakeReady OK')
	// 					}
	// 				},
	// 				'devicesMakeReady',
	// 				okToDestoryStuff,
	// 				rundownPlaylistToBeActivated._id
	// 			)
	// 		})
	// 	)
	// )
}
/**
 * Makes a studio "stand down" after a broadcast
 * @param studio
 * @param okToDestoryStuff true if we're not ON AIR, things might flicker on the output
 */
export async function standDownStudio(cache: CacheForPlayout, _okToDestoryStuff: boolean): Promise<void> {
	logger.info('standDownStudio ' + cache.Studio.doc._id)

	// TODO - need to fire some 'DDP commands'

	// 	const playoutDevices = cache.PeripheralDevices.findFetch((p) => p.type === PeripheralDeviceType.PLAYOUT)

	// 	await Promise.allSettled(
	// 		playoutDevices.map(async (device) =>
	// 			makePromise(() => {
	// 				PeripheralDeviceAPI.executeFunction(
	// 					device._id,
	// 					(err) => {
	// 						if (err) {
	// 							logger.error(err)
	// 						} else {
	// 							logger.info('devicesStandDown OK')
	// 						}
	// 					},
	// 					'devicesStandDown',
	// 					okToDestoryStuff
	// 				)
	// 			})
	// 		)
	// 	)
}
