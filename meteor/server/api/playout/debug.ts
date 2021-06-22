import { Meteor } from 'meteor/meteor'
import { logger } from '../../logging'
import { waitForPromise, waitForPromiseAll } from '../../../lib/lib'
import { RundownPlaylists, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { Settings } from '../../../lib/Settings'
import { setNextPart } from './lib'
import { syncPlayheadInfinitesForNextPartInstance } from './infinites'
import { forceClearAllActivationCaches } from '../../cache/ActivationCache'
import { PartInstances } from '../../../lib/collections/PartInstances'
import { PieceInstances } from '../../../lib/collections/PieceInstances'
import { updateStudioOrPlaylistTimeline, updateTimeline } from './timeline'
import { forceClearAllBlueprintConfigCaches } from '../blueprints/config'
import {
	PlayoutLockFunctionPriority,
	runPlayoutOperationWithCache,
	runPlayoutOperationWithCacheFromStudioOperation,
} from './lockFunction'
import { getSelectedPartInstancesFromCache } from './cache'
import { removeRundownPlaylistFromDb } from '../rundownPlaylist'
import { check } from 'meteor/check'
import { StudioId } from '../../../lib/collections/Studios'
import { ensureNextPartIsValid } from '../ingest/updateNext'
import { runStudioOperationWithCache, StudioLockFunctionPriority } from '../studio/lockFunction'

if (!Settings.enableUserAccounts) {
	// These are temporary method to fill the rundown database with some sample data
	// for development

	Meteor.methods({
		debug_removePlaylist(id: RundownPlaylistId) {
			logger.debug('Remove rundown "' + id + '"')

			const playlist = RundownPlaylists.findOne(id)
			if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${id}" not found`)
			waitForPromise(removeRundownPlaylistFromDb(playlist))
		},

		debug_removeAllPlaylists() {
			logger.debug('Remove all rundowns')

			waitForPromiseAll(RundownPlaylists.find({}).map((playlist) => removeRundownPlaylistFromDb(playlist)))
		},

		debug_updateTimeline: (studioId: StudioId) => {
			try {
				check(studioId, String)
				logger.info(`debug_updateTimeline: "${studioId}"`)

				waitForPromise(
					runStudioOperationWithCache(
						'debug_updateTimeline',
						studioId,
						StudioLockFunctionPriority.USER_PLAYOUT,
						async (cache) => {
							await updateStudioOrPlaylistTimeline(cache)
						}
					)
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

				waitForPromise(
					runStudioOperationWithCache(
						'debug_updateNext',
						studioId,
						StudioLockFunctionPriority.USER_PLAYOUT,
						async (cache) => {
							const playlists = cache.getActiveRundownPlaylists()
							if (playlists.length === 1) {
								await runPlayoutOperationWithCacheFromStudioOperation(
									'updateStudioOrPlaylistTimeline',
									cache,
									playlists[0],
									PlayoutLockFunctionPriority.USER_PLAYOUT,
									null,
									async (playlistCache) => {
										await ensureNextPartIsValid(playlistCache)
									}
								)
							} else {
								throw new Error('No playlist active')
							}
						}
					)
				)
			} catch (e) {
				logger.error(e)
				throw e
			}
		},

		debug_syncPlayheadInfinitesForNextPartInstance(id: RundownPlaylistId) {
			logger.info(`syncPlayheadInfinitesForNextPartInstance ${id}`)

			runPlayoutOperationWithCache(
				null,
				'debug_syncPlayheadInfinitesForNextPartInstance',
				id,
				PlayoutLockFunctionPriority.MISC,
				null,
				async (cache) => {
					await syncPlayheadInfinitesForNextPartInstance(cache)
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

			runPlayoutOperationWithCache(
				null,
				'debug_regenerateNextPartInstance',
				id,
				PlayoutLockFunctionPriority.MISC,
				null,
				async (cache) => {
					const playlist = cache.Playlist.doc
					if (playlist.nextPartInstanceId && playlist.activationId) {
						const { nextPartInstance } = getSelectedPartInstancesFromCache(cache)
						const part = nextPartInstance ? cache.Parts.findOne(nextPartInstance.part._id) : undefined
						if (part) {
							setNextPart(cache, null)
							setNextPart(cache, { part: part })

							await updateTimeline(cache)
						}
					}
				}
			)
		},
	})
}
