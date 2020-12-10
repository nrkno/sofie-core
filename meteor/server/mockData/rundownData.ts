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
import { initCacheForRundownPlaylistFromRundown, initCacheForRundownPlaylist } from '../DatabaseCaches'
import { removeRundownPlaylistFromCache, setNextPart, getSelectedPartInstancesFromCache } from '../api/playout/lib'
import { rundownPlaylistSyncFunction, RundownSyncFunctionPriority } from '../api/ingest/rundownInput'
import { syncPlayheadInfinitesForNextPartInstance } from '../api/playout/infinites'
import { forceClearAllActivationCaches } from '../ActivationCache'
import { PartInstances } from '../../lib/collections/PartInstances'
import { PieceInstances } from '../../lib/collections/PieceInstances'
import { updateTimeline } from '../api/playout/timeline'
import { getActiveRundownPlaylistsInStudio } from '../api/playout/studio'
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

		debug_rundownSetStarttimeSoon() {
			let rundown = Rundowns.findOne({
				active: true,
			})
			if (rundown) {
				Rundowns.update(rundown._id, {
					$set: {
						expectedStart: getCurrentTime() + 70 * 1000,
					},
				})
			}
		},

		debug_removeRundown(id: RundownPlaylistId) {
			logger.debug('Remove rundown "' + id + '"')

			const playlist = RundownPlaylists.findOne(id)
			if (playlist) {
				const cache = waitForPromise(initCacheForRundownPlaylist(playlist))
				removeRundownPlaylistFromCache(cache, playlist)
				waitForPromise(cache.saveAllToDatabase())
			}
		},

		debug_removeAllRos() {
			logger.debug('Remove all rundowns')

			RundownPlaylists.find({}).forEach((playlist) => {
				const cache = waitForPromise(initCacheForRundownPlaylist(playlist))
				removeRundownPlaylistFromCache(cache, playlist)
				waitForPromise(cache.saveAllToDatabase())
			})
		},

		debug_recreateExpectedMediaItems() {
			const rundowns = Rundowns.find().fetch()

			rundowns.map((i) => {
				const cache = waitForPromise(initCacheForRundownPlaylistFromRundown(i._id)) // todo: is this correct? - what if rundown has no playlist?
				updateExpectedMediaItemsOnRundown(cache, i._id)
				waitForPromise(cache.saveAllToDatabase())
			})
		},

		debug_syncPlayheadInfinitesForNextPartInstance(id: RundownPlaylistId) {
			logger.info(`syncPlayheadInfinitesForNextPartInstance ${id}`)

			rundownPlaylistSyncFunction(
				id,
				RundownSyncFunctionPriority.USER_PLAYOUT,
				'debug_syncPlayheadInfinitesForNextPartInstance',
				() => {
					const playlist = RundownPlaylists.findOne(id)
					if (!playlist) throw new Meteor.Error(404, 'not found')

					const cache = waitForPromise(initCacheForRundownPlaylist(playlist))
					syncPlayheadInfinitesForNextPartInstance(cache, playlist)
					waitForPromise(cache.saveAllToDatabase())
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

			PartInstances.remove({ reset: true })
			PieceInstances.remove({ reset: true })
		},

		debug_regenerateNextPartInstance(id: RundownPlaylistId) {
			logger.info('regenerateNextPartInstance')

			rundownPlaylistSyncFunction(
				id,
				RundownSyncFunctionPriority.USER_PLAYOUT,
				'debug_regenerateNextPartInstance',
				() => {
					const playlist = RundownPlaylists.findOne(id)
					if (!playlist) throw new Meteor.Error(404, 'not found')

					if (playlist.nextPartInstanceId && playlist.active) {
						const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

						const { nextPartInstance } = getSelectedPartInstancesFromCache(cache, playlist)
						const part = nextPartInstance ? cache.Parts.findOne(nextPartInstance.part._id) : undefined
						if (part) {
							setNextPart(cache, playlist, null)
							const playlist2 = cache.RundownPlaylists.findOne(playlist._id) as RundownPlaylist
							setNextPart(cache, playlist2, part)

							updateTimeline(cache, playlist.studioId)
						}

						waitForPromise(cache.saveAllToDatabase())
					}
				}
			)
		},
	})
}
