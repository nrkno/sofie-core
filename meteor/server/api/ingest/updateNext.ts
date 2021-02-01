import * as _ from 'underscore'
import {
	ServerPlayoutAPI,
	rundownPlaylistPlayoutSyncFunction,
	rundownPlaylistPlayoutSyncFunctionInner,
} from '../playout/playout'
import { selectNextPart, isTooCloseToAutonext, getAllOrderedPartsFromPlayoutCache } from '../playout/lib'
import { CacheForIngest } from '../../cache/DatabaseCaches'
import { IngestPlayoutInfo } from './lib'
import { profiler } from '../profiler'

export namespace UpdateNext {
	export function ensureNextPartIsValid(_ingestCache: CacheForIngest, playoutInfo: IngestPlayoutInfo) {
		const span = profiler.startSpan('api.ingest.ensureNextPartIsValid')

		const { playlist, currentPartInstance, nextPartInstance } = playoutInfo

		// Ensure the next-id is still valid
		if (playlist.active && playlist.nextPartInstanceId) {
			// Note: we have the playlist lock, so we can use the db directly
			const allParts = playoutInfo.playlist.getAllOrderedParts()

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

			if (currentPartInstance && nextPartInstance) {
				// Check if the part is the same
				const newNextPart = selectNextPart(playlist, currentPartInstance, allParts)
				if (!newNextPart) {
					// No new next, so leave as is
					span?.end()
					return
				}

				if (newNextPart?.part?._id !== nextPartInstance.part._id || !nextPartInstance.part.isPlayable()) {
					// The 'new' next part is before the current next, so move the next point
					rundownPlaylistPlayoutSyncFunctionInner('ensureNextPartIsValid', playlist, null, (cache) => {
						ServerPlayoutAPI.setNextPartInner(cache, newNextPart.part)
					})
				}
			} else if (!nextPartInstance) {
				// Don't have a currentPart or a nextPart, so set next to first in the show
				const newNextPart = selectNextPart(playlist, currentPartInstance ?? null, allParts)
				rundownPlaylistPlayoutSyncFunctionInner('ensureNextPartIsValid', playlist, null, (cache) => {
					ServerPlayoutAPI.setNextPartInner(cache, newNextPart?.part ?? null)
				})
			}
		}

		span?.end()
	}
}
