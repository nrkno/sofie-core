import { Meteor } from 'meteor/meteor'
import { check } from '../../../lib/check'
import { IngestActions } from './actions'
import { RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { Settings } from '../../../lib/Settings'
import { SegmentId, Segments } from '../../../lib/collections/Segments'
import { RundownIngestDataCache } from './ingestCache'
import { Rundowns } from '../../../lib/collections/Rundowns'
import { handleUpdatedSegment } from './rundownInput'
import { PeripheralDevice } from '../../../lib/collections/PeripheralDevices'
import { logger } from '../../logging'
import { waitForPromise, waitForPromiseAll } from '../../../lib/lib'
import { updateExpectedMediaItemsOnRundown } from './expectedMediaItems'
import { runIngestOperationFromRundown } from './lockFunction'
import { updateExpectedPackagesOnRundown } from './expectedPackages'

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

			waitForPromise(
				handleUpdatedSegment(
					{ studioId: rundown.studioId } as PeripheralDevice,
					rundown.externalId,
					ingestSegment,
					true
				)
			)
		},
		debug_recreateExpectedMediaItems() {
			const rundowns = Rundowns.find().fetch()

			waitForPromiseAll(
				rundowns.map((rundown) =>
					runIngestOperationFromRundown('', rundown, async (cache) =>
						updateExpectedMediaItemsOnRundown(cache)
					)
				)
			)
		},
		debug_recreateExpectedPackages() {
			const rundowns = Rundowns.find().fetch()

			waitForPromiseAll(
				rundowns.map((rundown) =>
					runIngestOperationFromRundown('', rundown, async (cache) => updateExpectedPackagesOnRundown(cache))
				)
			)
		},
	})
}
