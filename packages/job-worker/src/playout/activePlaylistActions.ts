import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { getRandomId, stringifyError } from '@sofie-automation/corelib/dist/lib'
import { getActiveRundownPlaylistsInStudioFromDb } from '../studio/lib'
import _ = require('underscore')
import { JobContext } from '../jobs'
import { logger } from '../logging'
import { CacheForPlayout, getOrderedSegmentsAndPartsFromPlayoutCache, getSelectedPartInstancesFromCache } from './cache'
import { resetRundownPlaylist } from './lib'
import { selectNextPart } from './selectNextPart'
import { setNextPart } from './setNext'
import { updateStudioTimeline, updateTimeline } from './timeline/generate'
import { getCurrentTime } from '../lib'
import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { EventsJobs } from '@sofie-automation/corelib/dist/worker/events'
import { RundownPlaylistActivationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { cleanTimelineDatastore } from './datastore'
import { RundownActivationContext } from '../blueprints/context/RundownActivationContext'

export async function activateRundownPlaylist(
	context: JobContext,
	cache: CacheForPlayout,
	rehearsal: boolean
): Promise<void> {
	logger.info('Activating rundown ' + cache.Playlist.doc._id + (rehearsal ? ' (Rehearsal)' : ''))

	rehearsal = !!rehearsal
	const wasActive = !!cache.Playlist.doc.activationId

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
			p.currentPartInfo = null
			p.nextPartInfo = null
			p.previousPartInfo = null
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
		await setNextPart(context, cache, firstPart, false)

		if (firstPart) {
			rundown = cache.Rundowns.findOne(firstPart.part.rundownId)
		}
	} else {
		// Otherwise preserve the active partInstances
		const partInstancesToPreserve = new Set(
			_.compact([
				cache.Playlist.doc.nextPartInfo?.partInstanceId,
				cache.Playlist.doc.currentPartInfo?.partInstanceId,
				cache.Playlist.doc.previousPartInfo?.partInstanceId,
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

		if (cache.Playlist.doc.nextPartInfo) {
			const nextPartInstance = cache.PartInstances.findOne(cache.Playlist.doc.nextPartInfo.partInstanceId)
			if (!nextPartInstance)
				throw new Error(`Could not find nextPartInstance "${cache.Playlist.doc.nextPartInfo.partInstanceId}"`)
			rundown = cache.Rundowns.findOne(nextPartInstance.rundownId)
			if (!rundown) throw new Error(`Could not find rundown "${nextPartInstance.rundownId}"`)
		}
	}

	await updateTimeline(context, cache)

	cache.deferBeforeSave(async () => {
		if (!rundown) return // if the proper rundown hasn't been found, there's little point doing anything else
		const showStyle = await context.getShowStyleCompound(rundown.showStyleVariantId, rundown.showStyleBaseId)
		const blueprint = await context.getShowStyleBlueprint(showStyle._id)

		try {
			if (blueprint.blueprint.onRundownActivate) {
				const context2 = new RundownActivationContext(context, cache, showStyle, rundown)

				await blueprint.blueprint.onRundownActivate(context2, wasActive)
			}
		} catch (err) {
			logger.error(`Error in showStyleBlueprint.onRundownActivate: ${stringifyError(err)}`)
		}
	})
}
export async function deactivateRundownPlaylist(context: JobContext, cache: CacheForPlayout): Promise<void> {
	const rundown = await deactivateRundownPlaylistInner(context, cache)

	await updateStudioTimeline(context, cache)

	cache.deferDuringSaveTransaction(async (transaction) => {
		await cleanTimelineDatastore(context, cache, transaction)
	})

	cache.deferBeforeSave(async () => {
		if (rundown) {
			const showStyle = await context.getShowStyleCompound(rundown.showStyleVariantId, rundown.showStyleBaseId)
			const blueprint = await context.getShowStyleBlueprint(showStyle._id)

			try {
				if (blueprint.blueprint.onRundownDeActivate) {
					const blueprintContext = new RundownActivationContext(context, cache, showStyle, rundown)
					await blueprint.blueprint.onRundownDeActivate(blueprintContext)
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
		p.previousPartInfo = null
		p.currentPartInfo = null
		p.holdState = RundownHoldState.NONE

		delete p.activationId
		delete p.nextSegmentId

		return p
	})
	await setNextPart(context, cache, null, false)

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
