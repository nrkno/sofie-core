import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { getActiveRundownPlaylistsInStudioFromDb } from '../studio/lib'
import { JobContext } from '../jobs'
import { logger } from '../logging'
import { PlayoutModel } from './model/PlayoutModel'
import { resetRundownPlaylist } from './lib'
import { selectNextPart } from './selectNextPart'
import { setNextPart } from './setNext'
import { updateStudioTimeline, updateTimeline } from './timeline/generate'
import { getCurrentTime } from '../lib'
import { EventsJobs } from '@sofie-automation/corelib/dist/worker/events'
import { cleanTimelineDatastore } from './datastore'
import { RundownActivationContext } from '../blueprints/context/RundownActivationContext'
import { ReadonlyDeep } from 'type-fest'

export async function activateRundownPlaylist(
	context: JobContext,
	cache: PlayoutModel,
	rehearsal: boolean
): Promise<void> {
	logger.info('Activating rundown ' + cache.Playlist._id + (rehearsal ? ' (Rehearsal)' : ''))

	rehearsal = !!rehearsal
	const wasActive = !!cache.Playlist.activationId

	const anyOtherActiveRundowns = await getActiveRundownPlaylistsInStudioFromDb(
		context,
		context.studio._id,
		cache.Playlist._id
	)
	if (anyOtherActiveRundowns.length) {
		// logger.warn('Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id))
		const otherActiveIds = anyOtherActiveRundowns.map((playlist) => playlist._id)
		throw new Error(
			'Only one rundown can be active at the same time. Active rundown playlists: ' +
				JSON.stringify(otherActiveIds)
		)
	}

	if (!cache.Playlist.activationId) {
		// Reset the playlist if it wasnt already active
		await resetRundownPlaylist(context, cache)
	}

	const newActivationId = cache.activatePlaylist(rehearsal)

	let rundown: ReadonlyDeep<DBRundown> | undefined

	const currentPartInstance = cache.CurrentPartInstance
	if (!currentPartInstance || currentPartInstance.PartInstance.reset) {
		cache.clearSelectedPartInstances()

		// If we are not playing anything, then regenerate the next part
		const firstPart = selectNextPart(
			context,
			cache.Playlist,
			null,
			null,
			cache.getAllOrderedSegments(),
			cache.getAllOrderedParts()
		)
		await setNextPart(context, cache, firstPart, false)

		if (firstPart) {
			rundown = cache.getRundown(firstPart.part.rundownId)?.Rundown
		}
	} else {
		// Otherwise preserve the active partInstances
		for (const partInstance of cache.SelectedPartInstances) {
			partInstance.setPlaylistActivationId(newActivationId)
		}

		const nextPartInstance = cache.NextPartInstance
		if (nextPartInstance) {
			rundown = cache.getRundown(nextPartInstance.PartInstance.rundownId)?.Rundown
			if (!rundown) throw new Error(`Could not find rundown "${nextPartInstance.PartInstance.rundownId}"`)
		}
	}

	await updateTimeline(context, cache)

	cache.deferBeforeSave(async () => {
		if (!rundown) return // if the proper rundown hasn't been found, there's little point doing anything else
		const showStyle = await context.getShowStyleCompound(rundown.showStyleVariantId, rundown.showStyleBaseId)
		const blueprint = await context.getShowStyleBlueprint(showStyle._id)

		try {
			if (blueprint.blueprint.onRundownActivate) {
				const blueprintContext = new RundownActivationContext(context, cache, showStyle, rundown)

				await blueprint.blueprint.onRundownActivate(blueprintContext, wasActive)
			}
		} catch (err) {
			logger.error(`Error in showStyleBlueprint.onRundownActivate: ${stringifyError(err)}`)
		}
	})
}
export async function deactivateRundownPlaylist(context: JobContext, cache: PlayoutModel): Promise<void> {
	const rundown = await deactivateRundownPlaylistInner(context, cache)

	await updateStudioTimeline(context, cache)

	await cleanTimelineDatastore(context, cache)

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
	cache: PlayoutModel
): Promise<ReadonlyDeep<DBRundown> | undefined> {
	const span = context.startSpan('deactivateRundownPlaylistInner')
	logger.info(`Deactivating rundown playlist "${cache.Playlist._id}"`)

	const currentPartInstance = cache.CurrentPartInstance
	const nextPartInstance = cache.NextPartInstance

	let rundown: ReadonlyDeep<DBRundown> | undefined
	if (currentPartInstance) {
		rundown = cache.getRundown(currentPartInstance.PartInstance.rundownId)?.Rundown

		cache.deferAfterSave(async () => {
			context
				.queueEventJob(EventsJobs.NotifyCurrentlyPlayingPart, {
					rundownId: currentPartInstance.PartInstance.rundownId,
					isRehearsal: !!cache.Playlist.rehearsal,
					partExternalId: null,
				})
				.catch((e) => {
					logger.warn(`Failed to queue NotifyCurrentlyPlayingPart job: ${e}`)
				})
		})
	} else if (nextPartInstance) {
		rundown = cache.getRundown(nextPartInstance.PartInstance.rundownId)?.Rundown
	}

	cache.clearSelectedPartInstances()
	cache.deactivatePlaylist()

	await setNextPart(context, cache, null, false)

	if (currentPartInstance) {
		// Set the current PartInstance as stopped
		currentPartInstance.setPlannedStoppedPlayback(getCurrentTime())
	}

	if (span) span.end()
	return rundown
}
