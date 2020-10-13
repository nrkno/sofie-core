import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { check } from '../../../lib/check'
import { IngestActions } from './actions'
import { updateTimeline, getActiveRundownPlaylist } from '../playout/timeline'
import { RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { StudioId } from '../../../lib/collections/Studios'

import { Settings } from '../../../lib/Settings'
import { initCacheForNoRundownPlaylist, initCacheForRundownPlaylist } from '../../DatabaseCaches'
import { waitForPromise } from '../../../lib/lib'
import { SegmentId, Segments } from '../../../lib/collections/Segments'
import { loadCachedIngestSegment } from './ingestCache'
import { Rundowns } from '../../../lib/collections/Rundowns'
import { handleUpdatedSegment } from './rundownInput'
import { PeripheralDevice } from '../../../lib/collections/PeripheralDevices'

if (!Settings.enableUserAccounts) {
	Meteor.methods({
		debug_playlistRunBlueprints: (rundownPlaylistId: RundownPlaylistId, purgeExisting?: boolean) => {
			check(rundownPlaylistId, String)
			IngestActions.regenerateRundownPlaylist(rundownPlaylistId, purgeExisting)
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

			handleUpdatedSegment({ studioId: rundown.studioId } as PeripheralDevice, rundown.externalId, ingestSegment)
		},
		debug_updateTimeline: (studioId: StudioId) => {
			check(studioId, String)

			const cache = waitForPromise(initCacheForNoRundownPlaylist(studioId))

			const activePlaylist = getActiveRundownPlaylist(cache, studioId)
			if (activePlaylist) {
				const cacheForPlaylist = waitForPromise(initCacheForRundownPlaylist(activePlaylist, cache))
				updateTimeline(cacheForPlaylist, studioId)
				waitForPromise(cacheForPlaylist.saveAllToDatabase())
			} else {
				updateTimeline(cache, studioId)
				waitForPromise(cache.saveAllToDatabase())
			}
		},
	})
}
