import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { getRandomId, stringifyError } from '@sofie-automation/corelib/dist/lib'
import { getActiveRundownPlaylistsInStudioFromDb } from '../studio/lib'
import _ = require('underscore')
import { JobContext } from '../jobs'
import { logger } from '../logging'
import { CacheForPlayout, getOrderedSegmentsAndPartsFromPlayoutCache, getSelectedPartInstancesFromCache } from './cache'
import { resetRundownPlaylist, selectNextPart } from './lib'
import { setNextPart } from './setNext'
import { updateStudioTimeline, updateTimeline } from './timeline/generate'
import { RundownEventContext } from '../blueprints/context'
import { getCurrentTime } from '../lib'
import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { executePeripheralDeviceFunction } from '../peripheralDevice'
import { EventsJobs } from '@sofie-automation/corelib/dist/worker/events'
import { RundownPlaylistActivationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { cleanTimelineDatastore } from './datastore'

export async function activateRundownPlaylist(
	context: JobContext,
	cache: CacheForPlayout,
	rehearsal: boolean
): Promise<void> {
	logger.info('Activating rundown ' + cache.Playlist.doc._id + (rehearsal ? ' (Rehearsal)' : ''))

	rehearsal = !!rehearsal

	const anyOtherActiveRundowns = await getActiveRundownPlaylistsInStudioFromDb(
		context,
		context.studio._id,
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

	const newActivationId: RundownPlaylistActivationId = getRandomId()
	cache.Playlist.update((p) => {
		p.activationId = newActivationId
		p.rehearsal = rehearsal
		return p
	})

	let rundown: DBRundown | undefined

	const { currentPartInstance } = getSelectedPartInstancesFromCache(cache)
	if (!currentPartInstance || currentPartInstance.reset) {
		cache.Playlist.update((p) => {
			p.currentPartInstanceId = null
			p.nextPartInstanceId = null
			p.previousPartInstanceId = null
			return p
		})

		// If we are not playing anything, then regenerate the next part
		const firstPart = selectNextPart(
			context,
			cache.Playlist.doc,
			null,
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
		cache.PartInstances.updateAll((p) => {
			if (partInstancesToPreserve.has(p._id)) {
				p.playlistActivationId = newActivationId
				return p
			} else {
				return false
			}
		})
		cache.PieceInstances.updateAll((p) => {
			if (partInstancesToPreserve.has(p.partInstanceId)) {
				p.playlistActivationId = newActivationId
				return p
			} else {
				return false
			}
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

	cache.defer(async () => {
		if (!rundown) return // if the proper rundown hasn't been found, there's little point doing anything else
		const showStyle = await context.getShowStyleCompound(rundown.showStyleVariantId, rundown.showStyleBaseId)
		const blueprint = await context.getShowStyleBlueprint(showStyle._id)

		try {
			if (blueprint.blueprint.onRundownActivate) {
				const context2 = new RundownEventContext(
					context.studio,
					context.getStudioBlueprintConfig(),
					showStyle,
					context.getShowStyleBlueprintConfig(showStyle),
					rundown
				)

				await blueprint.blueprint.onRundownActivate(context2)
			}
		} catch (err) {
			logger.error(`Error in showStyleBlueprint.onRundownActivate: ${stringifyError(err)}`)
		}
	})
}
export async function deactivateRundownPlaylist(context: JobContext, cache: CacheForPlayout): Promise<void> {
	const rundown = await deactivateRundownPlaylistInner(context, cache)

	await updateStudioTimeline(context, cache)

	await cleanTimelineDatastore(context, cache)

	cache.defer(async () => {
		if (rundown) {
			const showStyle = await context.getShowStyleCompound(rundown.showStyleVariantId, rundown.showStyleBaseId)
			const blueprint = await context.getShowStyleBlueprint(showStyle._id)

			try {
				if (blueprint.blueprint.onRundownDeActivate) {
					const context2 = new RundownEventContext(
						context.studio,
						context.getStudioBlueprintConfig(),
						showStyle,
						context.getShowStyleBlueprintConfig(showStyle),
						rundown
					)
					await blueprint.blueprint.onRundownDeActivate(context2)
				}
			} catch (err) {
				logger.error(`Error in showStyleBlueprint.onRundownDeActivate: ${stringifyError(err)}`)
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

		cache.deferAfterSave(async () => {
			context
				.queueEventJob(EventsJobs.NotifyCurrentlyPlayingPart, {
					rundownId: currentPartInstance.rundownId,
					isRehearsal: !!cache.Playlist.doc.rehearsal,
					partExternalId: null,
				})
				.catch((e) => {
					logger.warn(`Failed to queue NotifyCurrentlyPlayingPart job: ${e}`)
				})
		})
	} else if (nextPartInstance) {
		rundown = cache.Rundowns.findOne(nextPartInstance.rundownId)
	}

	cache.Playlist.update((p) => {
		p.previousPartInstanceId = null
		p.currentPartInstanceId = null
		p.holdState = RundownHoldState.NONE

		delete p.activationId
		delete p.nextSegmentId

		return p
	})
	await setNextPart(context, cache, null)

	if (currentPartInstance) {
		// Set the current PartInstance as stopped
		cache.PartInstances.updateOne(currentPartInstance._id, (instance) => {
			if (
				instance.timings &&
				instance.timings.plannedStartedPlayback &&
				!instance.timings.plannedStoppedPlayback
			) {
				instance.timings.plannedStoppedPlayback = getCurrentTime()
				instance.timings.duration = getCurrentTime() - instance.timings.plannedStartedPlayback
				return instance
			}
			return false
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
export async function prepareStudioForBroadcast(
	context: JobContext,
	cache: CacheForPlayout,
	okToDestoryStuff: boolean
): Promise<void> {
	const rundownPlaylistToBeActivated = cache.Playlist.doc
	logger.info('prepareStudioForBroadcast ' + context.studio._id)

	const playoutDevices = cache.PeripheralDevices.findAll((p) => p.type === PeripheralDeviceType.PLAYOUT)

	for (const device of playoutDevices) {
		// Fire the command and don't wait for the result
		executePeripheralDeviceFunction(
			context,
			device._id,
			null,
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
export async function standDownStudio(
	context: JobContext,
	cache: CacheForPlayout,
	okToDestoryStuff: boolean
): Promise<void> {
	logger.info('standDownStudio ' + context.studio._id)

	const playoutDevices = cache.PeripheralDevices.findAll((p) => p.type === PeripheralDeviceType.PLAYOUT)

	for (const device of playoutDevices) {
		// Fire the command and don't wait for the result
		executePeripheralDeviceFunction(context, device._id, null, 'devicesStandDown', okToDestoryStuff)
			.then(() => {
				logger.info(`devicesStandDown: "${device._id}" OK`)
			})
			.catch((err) => {
				logger.error(`devicesStandDown: "${device._id} Fail: ${stringifyError(err)}"`)
			})
	}
}
