import { Meteor } from 'meteor/meteor'
import { Rundowns, Rundown, RundownId } from '../../lib/collections/Rundowns'
import { Pieces } from '../../lib/collections/Pieces'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { logger } from '../logging'
import { MediaObjects } from '../../lib/collections/MediaObjects'
import { getCurrentTime, waitForPromise } from '../../lib/lib'
import { check } from '../../lib/check'
import { Parts, PartId } from '../../lib/collections/Parts'
import { updateSourceLayerInfinitesAfterPart } from '../api/playout/infinites'
import { updateExpectedMediaItemsOnRundown } from '../api/expectedMediaItems'
import { RundownPlaylists, RundownPlaylistId } from '../../lib/collections/RundownPlaylists'
import { Settings } from '../../lib/Settings'
import { initCacheForRundownPlaylistFromRundown, initCacheForRundownPlaylist } from '../DatabaseCaches'
import { removeRundownPlaylistFromCache } from '../api/playout/lib'

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

		debug_updateSourceLayerInfinitesAfterPart(rundownId: RundownId, previousPartId?: PartId, runToEnd?: boolean) {
			check(rundownId, String)
			if (previousPartId) check(previousPartId, String)
			if (runToEnd !== undefined) check(runToEnd, Boolean)

			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, 'Rundown not found')

			const cache = waitForPromise(initCacheForRundownPlaylistFromRundown(rundown._id))
			const prevPart = previousPartId ? cache.Parts.findOne(previousPartId) : undefined

			updateSourceLayerInfinitesAfterPart(cache, rundown, prevPart, runToEnd)

			waitForPromise(cache.saveAllToDatabase())
			logger.info('debug_updateSourceLayerInfinitesAfterPart: done')
		},

		debug_recreateExpectedMediaItems() {
			const rundowns = Rundowns.find().fetch()

			rundowns.map((i) => {
				const cache = waitForPromise(initCacheForRundownPlaylistFromRundown(i._id)) // todo: is this correct? - what if rundown has no playlist?
				updateExpectedMediaItemsOnRundown(cache, i._id)
				waitForPromise(cache.saveAllToDatabase())
			})
		},
	})
}
