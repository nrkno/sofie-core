import { Meteor } from 'meteor/meteor'
import { logger } from '../../logging'
import { waitForPromise, waitForPromiseAll } from '../../../lib/lib'
import { RundownPlaylists, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { Settings } from '../../../lib/Settings'
import { PartInstances } from '../../../lib/collections/PartInstances'
import { PieceInstances } from '../../../lib/collections/PieceInstances'
import { check } from 'meteor/check'
import { StudioId } from '../../../lib/collections/Studios'
import { profiler } from '../profiler'
import { QueueForceClearAllCaches, QueueStudioJob } from '../../worker/worker'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { fetchStudioIds } from '../../../lib/collections/optimizations'

if (!Settings.enableUserAccounts) {
	// These are temporary method to fill the rundown database with some sample data
	// for development

	Meteor.methods({
		/**
		 * Remove a playlist from the system.
		 * This can be done in the ui too, but this will bypass any checks that are usually performed
		 */
		debug_removePlaylist(id: RundownPlaylistId) {
			logger.debug('Remove rundown "' + id + '"')

			const playlist = RundownPlaylists.findOne(id)
			if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${id}" not found`)

			const job = waitForPromise(
				QueueStudioJob(StudioJobs.RemovePlaylist, playlist.studioId, {
					playlistId: playlist._id,
				})
			)
			waitForPromise(job.complete)
		},

		/**
		 * Remove ALL playlists from the system.
		 * Be careful with this, it doesn't care that they might be active
		 */
		debug_removeAllPlaylists() {
			logger.debug('Remove all rundowns')

			waitForPromiseAll(
				RundownPlaylists.find({}).map(async (playlist) => {
					const job = await QueueStudioJob(StudioJobs.RemovePlaylist, playlist.studioId, {
						playlistId: playlist._id,
					})
					await job.complete
				})
			)
		},

		/**
		 * Regenerate the timeline for the specified studio
		 * This will rerun the onTimelineGenerate for your showstyle blueprints, and is particularly useful for debugging that
		 */
		debug_updateTimeline: (studioId: StudioId) => {
			try {
				check(studioId, String)
				logger.info(`debug_updateTimeline: "${studioId}"`)

				const transaction = profiler.startTransaction('updateTimeline', 'meteor-debug')

				const job = waitForPromise(QueueStudioJob(StudioJobs.UpdateTimeline, studioId, undefined))

				const span = transaction?.startSpan('queued-job')
				waitForPromise(job.complete)
				span?.end()

				console.log(waitForPromise(job.getTimings))

				if (transaction) transaction.end()

				logger.info(`debug_updateTimeline: "${studioId}" - done`)
			} catch (e) {
				logger.error(e)
				throw e
			}
		},

		/**
		 * Ensure that the infinite pieces on the nexted-part are correct
		 * Added to debug some issues with infinites not updating
		 */
		debug_syncPlayheadInfinitesForNextPartInstance(id: RundownPlaylistId) {
			logger.info(`syncPlayheadInfinitesForNextPartInstance ${id}`)

			const playlist = RundownPlaylists.findOne(id)
			if (!playlist) throw new Error(`RundownPlaylist "${id}" not found`)

			const job = waitForPromise(
				QueueStudioJob(StudioJobs.DebugSyncInfinitesForNextPartInstance, playlist.studioId, {
					playlistId: id,
				})
			)

			waitForPromise(job.complete)
		},

		/**
		 * Clear various caches in the system
		 * Good to run if you suspect a cache is stuck with some stale data
		 */
		debug_forceClearAllCaches() {
			logger.info('forceClearAllCaches')

			const studioIds = fetchStudioIds({})
			waitForPromise(QueueForceClearAllCaches(studioIds))
		},

		/**
		 * Remove all 'reset' partisntances and pieceinstances
		 * I don't know when this would be useful
		 */
		debug_clearAllResetInstances() {
			logger.info('clearAllResetInstances')

			PartInstances.remove({ reset: true })
			PieceInstances.remove({ reset: true })
		},

		/**
		 * Regenerate the nexted-partinstance from its part.
		 * This can be useful to get ingest updates across when the blueprint syncIngestUpdateToPartInstance method is not implemented, or to bypass that method when it is defined
		 */
		debug_regenerateNextPartInstance(id: RundownPlaylistId) {
			logger.info('regenerateNextPartInstance')

			const playlist = RundownPlaylists.findOne(id)
			if (!playlist) throw new Error(`RundownPlaylist "${id}" not found`)

			const job = waitForPromise(
				QueueStudioJob(StudioJobs.DebugRegenerateNextPartInstance, playlist.studioId, {
					playlistId: id,
				})
			)

			waitForPromise(job.complete)
		},
	})
}
