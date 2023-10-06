import { UpdateTimelineAfterIngestProps } from '@sofie-automation/corelib/dist/worker/studio'
import { JobContext } from '../jobs'
import { getSelectedPartInstancesFromCache } from './cache'
import { runJobWithPlaylistLock, runWithPlaylistCache } from './lock'
import { updateStudioTimeline, updateTimeline } from './timeline/generate'
import { getSystemVersion } from '../lib'
import { runJobWithStudioCache } from '../studio/lock'
import { shouldUpdateStudioBaselineInner as libShouldUpdateStudioBaselineInner } from '@sofie-automation/corelib/dist/studio/baseline'
import { CacheForStudio } from '../studio/cache'

/**
 * Update the timeline with a regenerated Studio Baseline
 * Has no effect if a Playlist is active
 */
export async function handleUpdateStudioBaseline(context: JobContext, _data: void): Promise<string | false> {
	return runJobWithStudioCache(context, async (cache) => {
		const activePlaylists = cache.getActiveRundownPlaylists()

		if (activePlaylists.length === 0) {
			await updateStudioTimeline(context, cache)
			return shouldUpdateStudioBaselineInner(context, cache)
		} else {
			return shouldUpdateStudioBaselineInner(context, cache)
		}
	})
}

async function shouldUpdateStudioBaselineInner(context: JobContext, cache: CacheForStudio): Promise<string | false> {
	const studio = context.studio

	if (cache.getActiveRundownPlaylists().length > 0) return false

	const timeline = cache.Timeline.doc
	const blueprint = studio.blueprintId ? await context.directCollections.Blueprints.findOne(studio.blueprintId) : null
	if (!blueprint) return 'missingBlueprint'

	return libShouldUpdateStudioBaselineInner(getSystemVersion(), studio, timeline, blueprint)
}

/**
 * Regenerate the timeline for the specified Playlist in the Studio
 * Has no effect if specified Playlist is not active
 */
export async function handleUpdateTimelineAfterIngest(
	context: JobContext,
	data: UpdateTimelineAfterIngestProps
): Promise<void> {
	await runJobWithPlaylistLock(context, data, async (playlist, lock) => {
		if (playlist && playlist.activationId && (playlist.currentPartInstanceId || playlist.nextPartInstanceId)) {
			// TODO - r37 added a retry mechanic to this. should that be kept?
			await runWithPlaylistCache(context, playlist, lock, null, async (cache) => {
				const { currentPartInstance } = getSelectedPartInstancesFromCache(cache)
				if (
					!cache.isMultiGatewayMode &&
					currentPartInstance &&
					!currentPartInstance.timings?.reportedStartedPlayback
				) {
					// HACK: The current PartInstance doesn't have a start time yet, so we know an updateTimeline is coming as part of onPartPlaybackStarted
					// We mustn't run before that does, or we will get the timings in playout-gateway confused.
				} else {
					// It is safe enough (except adlibs) to update the timeline directly
					// If the playlist is active, then updateTimeline as lookahead could have been affected
					await updateTimeline(context, cache)
				}
			})
		}
	})
}
