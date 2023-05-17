import {
	DebugRegenerateNextPartInstanceProps,
	DebugSyncInfinitesForNextPartInstanceProps,
} from '@sofie-automation/corelib/dist/worker/studio'
import { runJobWithStudioCache } from '../studio/lock'
import { JobContext } from '../jobs'
import { logger } from '../logging'
import { getSelectedPartInstancesFromCache } from './cache'
import { syncPlayheadInfinitesForNextPartInstance } from './infinites'
import { setNextPart } from './setNext'
import { runJobWithPlayoutCache } from './lock'
import { updateStudioTimeline, updateTimeline } from './timeline/generate'

/**
 * Ensure that the infinite pieces on the nexted-part are correct
 * Added to debug some issues with infinites not updating
 */
export async function handleDebugSyncPlayheadInfinitesForNextPartInstance(
	context: JobContext,
	data: DebugSyncInfinitesForNextPartInstanceProps
): Promise<void> {
	logger.info(`syncPlayheadInfinitesForNextPartInstance ${data.playlistId}`)

	await runJobWithPlayoutCache(context, data, null, async (cache) => {
		await syncPlayheadInfinitesForNextPartInstance(context, cache)
	})
}

/**
 * Regenerate the nexted-partinstance from its part.
 * This can be useful to get ingest updates across when the blueprint syncIngestUpdateToPartInstance method is not implemented, or to bypass that method when it is defined
 */
export async function handleDebugRegenerateNextPartInstance(
	context: JobContext,
	data: DebugRegenerateNextPartInstanceProps
): Promise<void> {
	logger.info('regenerateNextPartInstance')

	await runJobWithPlayoutCache(context, data, null, async (cache) => {
		const playlist = cache.Playlist.doc
		if (playlist.nextPartInfo && playlist.activationId) {
			const { nextPartInstance } = getSelectedPartInstancesFromCache(cache)
			const part = nextPartInstance ? cache.Parts.findOne(nextPartInstance.part._id) : undefined
			if (part) {
				await setNextPart(context, cache, null)
				await setNextPart(context, cache, { part: part })

				await updateTimeline(context, cache)
			}
		}
	})
}

/**
 * Debug: Force the worker to throw an error
 */
export async function handleDebugCrash(context: JobContext, data: DebugRegenerateNextPartInstanceProps): Promise<void> {
	logger.info('debugCrash')

	await runJobWithPlayoutCache(context, data, null, async (cache) => {
		setTimeout(() => {
			//@ts-expect-error: 2339
			cache.callUndefined()
		}, 10)
	})
}

/**
 * Debug: Regenerate the timeline for the Studio
 */
export async function handleDebugUpdateTimeline(context: JobContext, _data: void): Promise<void> {
	await runJobWithStudioCache(context, async (studioCache) => {
		const activePlaylists = studioCache.getActiveRundownPlaylists()
		if (activePlaylists.length > 1) {
			throw new Error(`Too many active playlists`)
		} else if (activePlaylists.length > 0) {
			const playlist = activePlaylists[0]

			await runJobWithPlayoutCache(context, { playlistId: playlist._id }, null, async (playoutCache) => {
				await updateTimeline(context, playoutCache)
			})
		} else {
			await updateStudioTimeline(context, studioCache)
			await studioCache.saveAllToDatabase()
		}
	})
}
