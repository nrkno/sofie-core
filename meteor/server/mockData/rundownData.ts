import { Meteor } from 'meteor/meteor'
import { Rundowns } from '../../lib/collections/Rundowns'
import { Pieces } from '../../lib/collections/Pieces'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { logger } from '../logging'
import { MediaObjects } from '../../lib/collections/MediaObjects'
import { getCurrentTime, waitForPromise } from '../../lib/lib'
import { updateExpectedMediaItemsOnRundown } from '../api/expectedMediaItems'
import { RundownPlaylists, RundownPlaylistId, RundownPlaylist } from '../../lib/collections/RundownPlaylists'
import { Settings } from '../../lib/Settings'
import { getSelectedPartInstancesFromCache, setNextPart, removeRundownPlaylistFromDb } from '../api/playout/lib'
import { syncPlayheadInfinitesForNextPartInstance } from '../api/playout/infinites'
import { rundownPlaylistPlayoutSyncFunction } from '../api/playout/playout'
import { rundownIngestSyncFromStudioFunction } from '../api/ingest/lib'
import { forceClearAllActivationCaches } from '../cache/ActivationCache'
import { PartInstances } from '../../lib/collections/PartInstances'
import { PieceInstances } from '../../lib/collections/PieceInstances'
import { updateTimeline } from '../api/playout/timeline'
import { forceClearAllBlueprintConfigCaches } from '../api/blueprints/config'

if (!Settings.enableUserAccounts) {
	// These are temporary method to fill the rundown database with some sample data
	// for development

	Meteor.methods({
		debug_scrambleDurations() {
			let pieces = Pieces.find().fetch()
			_.each(pieces, (piece) => {
				Pieces.update(
					{ _id: piece._id },
					{
						$inc: {
							expectedDuration: Random.fraction() * 500 - 250,
						},
					}
				)
			})
		},

		debug_purgeMediaDB() {
			MediaObjects.remove({})
		},

		debug_removeRundownPlaylist(id: RundownPlaylistId) {
			logger.debug('Remove playlist "' + id + '"')

			// Note: this is not 'thread'-safe, but its only a debug tool

			waitForPromise(removeRundownPlaylistFromDb(id))
		},

		debug_removeAllRos() {
			logger.debug('Remove all rundowns')

			// Note: this is not 'thread'-safe, but its only a debug tool

			RundownPlaylists.find({}).forEach((playlist) => {
				waitForPromise(removeRundownPlaylistFromDb(playlist._id))
			})
		},

		debug_recreateExpectedMediaItems() {
			const rundowns = Rundowns.find().fetch()

			rundowns.map((r) => {
				rundownIngestSyncFromStudioFunction(
					'debug_recreateExpectedMediaItems',
					r.studioId,
					r.externalId,
					() => {
						// Nothing to prepare
					},
					(cache) => {
						updateExpectedMediaItemsOnRundown(cache)
					}
				)
			})
		},

		debug_syncPlayheadInfinitesForNextPartInstance(id: RundownPlaylistId) {
			logger.info(`syncPlayheadInfinitesForNextPartInstance ${id}`)

			rundownPlaylistPlayoutSyncFunction(
				null,
				'debug_syncPlayheadInfinitesForNextPartInstance',
				id,
				null,
				(cache) => {
					syncPlayheadInfinitesForNextPartInstance(cache)
				}
			)
		},

		debug_forceClearAllCaches() {
			logger.info('forceClearAllCaches')

			forceClearAllActivationCaches()
			forceClearAllBlueprintConfigCaches()
		},

		debug_clearAllResetInstances() {
			logger.info('clearAllResetInstances')

			// Note: this is not 'thread'-safe, but its only a debug tool

			PartInstances.remove({ reset: true })
			PieceInstances.remove({ reset: true })
		},

		debug_regenerateNextPartInstance(id: RundownPlaylistId) {
			logger.info('regenerateNextPartInstance')

			rundownPlaylistPlayoutSyncFunction(
				null,
				'debug_regenerateNextPartInstance',
				id,
				(cache) => {
					//
				},
				(cache) => {
					const playlist = cache.Playlist.doc

					if (playlist.nextPartInstanceId && playlist.activationId) {
						const { nextPartInstance } = getSelectedPartInstancesFromCache(cache)
						const part = nextPartInstance ? cache.Parts.findOne(nextPartInstance.part._id) : undefined
						if (part) {
							setNextPart(cache, null)
							setNextPart(cache, part)

							updateTimeline(cache)
						}
					}
				}
			)
		},
	})
}
