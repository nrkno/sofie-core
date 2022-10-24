import { Meteor } from 'meteor/meteor'
import { check } from '../../../lib/check'
import { RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { Settings } from '../../../lib/Settings'
import { Segments } from '../../../lib/collections/Segments'
import { Rundowns } from '../../../lib/collections/Rundowns'
import { logger } from '../../logging'
import { waitForPromise, waitForPromiseAll } from '../../../lib/lib'
import { runIngestOperation } from './lib'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import { QueueStudioJob } from '../../worker/worker'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'

if (!Settings.enableUserAccounts) {
	Meteor.methods({
		/**
		 * Simulate a 'Reload from NRCS' for the specified playlist
		 */
		debug_playlistRunBlueprints: (rundownPlaylistId: RundownPlaylistId) => {
			try {
				check(rundownPlaylistId, String)

				const playlist = RundownPlaylists.findOne(rundownPlaylistId)
				if (!playlist) throw new Error('Playlist not found')

				const job = waitForPromise(
					QueueStudioJob(StudioJobs.RegeneratePlaylist, playlist.studioId, {
						playlistId: playlist._id,
					})
				)
				waitForPromise(job.complete)
			} catch (e) {
				logger.error(e)
				throw e
			}
		},
		/**
		 * Simulate a 'Reload from NRCS' for a particular segment in a rundown
		 * Getting the segmentId is tricky, but can be done by either inspecting the DOM, or the mongo database
		 */
		debug_segmentRunBlueprints: (segmentId: SegmentId) => {
			check(segmentId, String)

			const segment = Segments.findOne(segmentId)
			if (!segment) throw new Meteor.Error(404, 'Segment not found')
			const rundown = Rundowns.findOne(segment.rundownId)
			if (!rundown) throw new Meteor.Error(404, 'Rundown not found')

			waitForPromise(
				runIngestOperation(rundown.studioId, IngestJobs.RegenerateSegment, {
					rundownExternalId: rundown.externalId,
					peripheralDeviceId: null,
					segmentExternalId: segment.externalId,
				})
			)
		},
		/**
		 * Regenerate all the expected packages for all rundowns in the system.
		 * Additionally it will recreate any expectedMediaItems and expectedPlayoutItems.
		 * This shouldn't be necessary as ingest will do this for each rundown as part of its workflow
		 */
		debug_recreateExpectedPackages() {
			const rundowns = Rundowns.find({
				restoredFromSnapshotId: { $exists: false },
			}).fetch()

			waitForPromiseAll(
				rundowns.map(async (rundown) =>
					runIngestOperation(rundown.studioId, IngestJobs.ExpectedPackagesRegenerate, {
						rundownId: rundown._id,
					})
				)
			)
		},
	})
}
