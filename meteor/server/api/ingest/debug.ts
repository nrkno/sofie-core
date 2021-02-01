import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { check } from '../../../lib/check'
import { IngestActions } from './actions'
import { updateStudioOrPlaylistTimeline } from '../playout/timeline'
import { RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { StudioId } from '../../../lib/collections/Studios'
import { Settings } from '../../../lib/Settings'
import { waitForPromise } from '../../../lib/lib'
import { SegmentId, Segments } from '../../../lib/collections/Segments'
import { loadCachedIngestSegment } from './ingestCache'
import { Rundowns } from '../../../lib/collections/Rundowns'
import { handleUpdatedSegment, studioSyncFunction } from './rundownInput'
import { PeripheralDevice } from '../../../lib/collections/PeripheralDevices'
import { logger } from '../../logging'
import { getReadonlyIngestObjectCache } from './lib'

if (!Settings.enableUserAccounts) {
	Meteor.methods({
		debug_playlistRunBlueprints: (rundownPlaylistId: RundownPlaylistId) => {
			try {
				check(rundownPlaylistId, String)
				IngestActions.regenerateRundownPlaylist(null, rundownPlaylistId)
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

			const ingestDataCache = waitForPromise(getReadonlyIngestObjectCache(rundown._id))
			const ingestSegment = loadCachedIngestSegment(
				ingestDataCache,
				rundown.externalId,
				segment._id,
				segment.externalId
			)

			handleUpdatedSegment({ studioId: rundown.studioId } as PeripheralDevice, rundown.externalId, ingestSegment)
		},
		debug_updateTimeline: (studioId: StudioId) => {
			try {
				check(studioId, String)

				studioSyncFunction('debug_updateTimeline', studioId, (cache) => {
					updateStudioOrPlaylistTimeline(cache)
				})
			} catch (e) {
				logger.error(e)
				throw e
			}
		},
	})
}
