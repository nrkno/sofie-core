import { ServerPlayoutAPI } from '../playout/playout'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import {
	selectNextPart,
	isTooCloseToAutonext,
	getSelectedPartInstancesFromCache,
	getSegmentsAndPartsFromCache,
} from '../playout/lib'
import { CacheForRundownPlaylist } from '../../cache/DatabaseCaches'
import { profiler } from '../profiler'
import { wrapWithProxyPlayoutCache } from '../playout/cache'

export namespace UpdateNext {
	export function ensureNextPartIsValid(cache: CacheForRundownPlaylist, playlist: RundownPlaylist) {
		const span = profiler.startSpan('api.ingest.ensureNextPartIsValid')

		// Ensure the next-id is still valid
		if (playlist && playlist.activationId) {
			const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache, playlist)

			if (playlist.nextPartManual && nextPartInstance?.part?.isPlayable()) {
				// Manual next part is always valid. This includes orphaned (adlib-part) partinstances
				span?.end()
				return
			}

			// If we are close to an autonext, then leave it to avoid glitches
			if (isTooCloseToAutonext(currentPartInstance) && nextPartInstance) {
				span?.end()
				return
			}

			const allPartsAndSegments = getSegmentsAndPartsFromCache(cache, playlist)

			if (currentPartInstance && nextPartInstance) {
				// Check if the part is the same
				const newNextPart = selectNextPart(playlist, currentPartInstance, allPartsAndSegments)
				if (!newNextPart) {
					// No new next, so leave as is
					span?.end()
					return
				}

				if (newNextPart?.part?._id !== nextPartInstance.part._id || !nextPartInstance.part.isPlayable()) {
					// The 'new' next part is before the current next, so move the next point
					wrapWithProxyPlayoutCache(cache, playlist, (playoutCache) => {
						ServerPlayoutAPI.setNextPartInner(playoutCache, newNextPart.part)
					})
				}
			} else if (!nextPartInstance) {
				// Don't have a currentPart or a nextPart, so set next to first in the show
				const newNextPart = selectNextPart(playlist, currentPartInstance ?? null, allPartsAndSegments)
				wrapWithProxyPlayoutCache(cache, playlist, (playoutCache) => {
					ServerPlayoutAPI.setNextPartInner(playoutCache, newNextPart?.part ?? null)
				})
			}
		}

		span?.end()
	}
}
