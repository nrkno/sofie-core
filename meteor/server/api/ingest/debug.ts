import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { check } from '../../../lib/check'
import { IngestActions } from './actions'
import { updateStudioOrPlaylistTimeline } from '../playout/timeline'
import { RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { StudioId } from '../../../lib/collections/Studios'

import { Settings } from '../../../lib/Settings'
import { SegmentId, Segments } from '../../../lib/collections/Segments'
import { loadCachedIngestSegment } from './ingestCache'
import { Rundowns } from '../../../lib/collections/Rundowns'
import { handleUpdatedSegment } from './rundownInput'
import { PeripheralDevice } from '../../../lib/collections/PeripheralDevices'
import { logger } from '../../logging'
import { runStudioOperationWithCache } from '../studio/syncFunction'

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

			const ingestSegment = loadCachedIngestSegment(
				rundown._id,
				rundown.externalId,
				segment._id,
				segment.externalId
			)

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

				runStudioOperationWithCache('debug_updateTimeline', studioId, (cache) => {
					updateStudioOrPlaylistTimeline(cache)
				})
			} catch (e) {
				logger.error(e)
				throw e
			}
		},
	})
}
