import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { check } from '../../../lib/check'
import { IngestActions } from './actions'
import { updateStudioOrPlaylistTimeline } from '../playout/timeline'
import { RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { StudioId } from '../../../lib/collections/Studios'
import { Settings } from '../../../lib/Settings'
import { SegmentId, Segments } from '../../../lib/collections/Segments'
import { RundownIngestDataCache } from './ingestCache'
import { Rundowns } from '../../../lib/collections/Rundowns'
import { handleUpdatedSegment } from './rundownInput'
import { PeripheralDevice } from '../../../lib/collections/PeripheralDevices'
import { logger } from '../../logging'
import { runStudioOperationWithCache, StudioLockFunctionPriority } from '../studio/lockFunction'
import { ensureNextPartIsValid } from './updateNext'
import { PlayoutLockFunctionPriority, runPlayoutOperationWithCacheFromStudioOperation } from '../playout/lockFunction'
import { waitForPromise } from '../../../lib/lib'

if (!Settings.enableUserAccounts) {
	Meteor.methods({
		debug_playlistRunBlueprints: (rundownPlaylistId: RundownPlaylistId, purgeExisting?: boolean) => {
			try {
				check(rundownPlaylistId, String)
				IngestActions.regenerateRundownPlaylist(null, rundownPlaylistId, purgeExisting)
			} catch (e) {
				logger.error(e)
				throw e
			}
		},
		debug_segmentRunBlueprints: (segmentId: SegmentId) => {
			check(segmentId, String)

			const segment = Segments.findOne(segmentId)
			if (!segment) throw new Meteor.Error(404, 'Segment not found')
			const rundown = Rundowns.findOne(segment.rundownId)
			if (!rundown) throw new Meteor.Error(404, 'Rundown not found')

			const ingestCache = waitForPromise(RundownIngestDataCache.create(rundown._id))
			const ingestSegment = ingestCache.fetchSegment(segment._id)
			if (!ingestSegment) throw new Meteor.Error(404, 'Segment ingest data not found')

			handleUpdatedSegment(
				{ studioId: rundown.studioId } as PeripheralDevice,
				rundown.externalId,
				ingestSegment,
				true
			)
		},
		debug_updateTimeline: (studioId: StudioId) => {
			try {
				check(studioId, String)
				logger.info(`debug_updateTimeline: "${studioId}"`)

				runStudioOperationWithCache(
					'debug_updateTimeline',
					studioId,
					StudioLockFunctionPriority.USER_PLAYOUT,
					(cache) => {
						updateStudioOrPlaylistTimeline(cache)
					}
				)
			} catch (e) {
				logger.error(e)
				throw e
			}
		},
		debug_updateNext: (studioId: StudioId) => {
			try {
				check(studioId, String)
				logger.info(`debug_updateNext: "${studioId}"`)

				runStudioOperationWithCache(
					'debug_updateNext',
					studioId,
					StudioLockFunctionPriority.USER_PLAYOUT,
					(cache) => {
						const playlists = cache.getActiveRundownPlaylists()
						if (playlists.length === 1) {
							return runPlayoutOperationWithCacheFromStudioOperation(
								'updateStudioOrPlaylistTimeline',
								cache,
								playlists[0],
								PlayoutLockFunctionPriority.USER_PLAYOUT,
								null,
								(playlistCache) => {
									ensureNextPartIsValid(playlistCache)
								}
							)
						} else {
							throw new Error('No playlist active')
						}
					}
				)
			} catch (e) {
				logger.error(e)
				throw e
			}
		},
	})
}
