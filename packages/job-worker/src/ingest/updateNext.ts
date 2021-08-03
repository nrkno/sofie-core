import { selectNextPart, isTooCloseToAutonext } from '../playout/lib'
import {
	CacheForPlayout,
	getOrderedSegmentsAndPartsFromPlayoutCache,
	getSelectedPartInstancesFromCache,
} from '../playout/cache'
import { JobContext } from '../jobs'
import { setNextPartInner } from '../playout/playout'
import { isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'

export async function ensureNextPartIsValid(context: JobContext, cache: CacheForPlayout): Promise<void> {
	const span = context.startSpan('api.ingest.ensureNextPartIsValid')

	// Ensure the next-id is still valid
	const playlist = cache.Playlist.doc
	if (playlist && playlist.activationId) {
		const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache)

		if (playlist.nextPartManual && nextPartInstance?.part && isPartPlayable(nextPartInstance.part)) {
			// Manual next part is always valid. This includes orphaned (adlib-part) partinstances
			span?.end()
			return
		}

		// If we are close to an autonext, then leave it to avoid glitches
		if (isTooCloseToAutonext(currentPartInstance) && nextPartInstance) {
			span?.end()
			return
		}

		const allPartsAndSegments = getOrderedSegmentsAndPartsFromPlayoutCache(cache)

		if (currentPartInstance && nextPartInstance) {
			// Check if the part is the same
			const newNextPart = selectNextPart(context, playlist, currentPartInstance, allPartsAndSegments)
			if (!newNextPart) {
				// No new next, so leave as is
				span?.end()
				return
			}

			if (newNextPart?.part?._id !== nextPartInstance.part._id || !isPartPlayable(nextPartInstance.part)) {
				// The 'new' next part is before the current next, so move the next point
				await setNextPartInner(context, cache, newNextPart.part)
			}
		} else if (!nextPartInstance || nextPartInstance.orphaned === 'deleted') {
			// Don't have a nextPart or it has been deleted, so autoselect something
			const newNextPart = selectNextPart(context, playlist, currentPartInstance ?? null, allPartsAndSegments)
			await setNextPartInner(context, cache, newNextPart?.part ?? null)
		}
	}

	span?.end()
}
