import { StudioId } from '../../lib/collections/Studios'
import { RundownPlaylists, RundownPlaylistId } from '../../lib/collections/RundownPlaylists'
import { RundownId, Rundowns } from '../../lib/collections/Rundowns'
import { waitForPromise, getHash, protectString, asyncCollectionRemove, makePromise } from '../../lib/lib'
import * as _ from 'underscore'
import { AdLibActions } from '../../lib/collections/AdLibActions'
import { AdLibPieces } from '../../lib/collections/AdLibPieces'
import { ExpectedMediaItems } from '../../lib/collections/ExpectedMediaItems'
import { ExpectedPlayoutItems } from '../../lib/collections/ExpectedPlayoutItems'
import { IngestDataCache } from '../../lib/collections/IngestDataCache'
import { PartInstances } from '../../lib/collections/PartInstances'
import { Parts } from '../../lib/collections/Parts'
import { PieceInstances } from '../../lib/collections/PieceInstances'
import { Pieces } from '../../lib/collections/Pieces'
import { RundownBaselineAdLibActions } from '../../lib/collections/RundownBaselineAdLibActions'
import { RundownBaselineAdLibPieces } from '../../lib/collections/RundownBaselineAdLibPieces'
import { RundownBaselineObjs } from '../../lib/collections/RundownBaselineObjs'
import { Segments } from '../../lib/collections/Segments'
import { studioLockWithCacheFunction } from './studio/syncFunction'
import { rundownPlaylistNoCacheLockFunction } from './playout/syncFunction'
import { RundownSyncFunctionPriority } from './ingest/rundownInput'

export function removeEmptyPlaylists(studioId: StudioId) {
	studioLockWithCacheFunction('removeEmptyPlaylists', studioId, async (cache) => {
		const playlists = cache.RundownPlaylists.findFetch()

		// We want to run them all in parallel fibers
		await Promise.allSettled(
			playlists.map(async (playlist) =>
				makePromise(() => {
					// Take the playlist lock, to ensure we don't fight something else
					rundownPlaylistNoCacheLockFunction(
						'removeEmptyPlaylists',
						playlist._id,
						RundownSyncFunctionPriority.USER_INGEST,
						() => {
							// TODO - is this correct priority?

							const rundowns = Rundowns.find({ playlistId: playlist._id }).count()
							if (rundowns === 0) {
								waitForPromise(removeRundownPlaylistFromDb(playlist._id))
							}
						}
					)
				})
			)
		)
	})
}
/**
 * Convert the playlistExternalId into a playlistId.
 * When we've received an externalId for a playlist, that can directly be used to reference a playlistId
 */
export function getPlaylistIdFromExternalId(studioId: StudioId, playlistExternalId: string): RundownPlaylistId {
	return protectString(getHash(`${studioId}_${playlistExternalId}`))
}

export async function removeRundownPlaylistFromDb(playlistId: RundownPlaylistId): Promise<void> {
	// We assume we have the master lock at this point
	const rundownIds = Rundowns.find({ playlistId }, { fields: { _id: 1 } }).map((r) => r._id)

	await Promise.allSettled([
		asyncCollectionRemove(RundownPlaylists, { _id: playlistId }),
		removeRundownsFromDb(rundownIds),
	])
}
export async function removeRundownsFromDb(rundownIds: RundownId[]): Promise<void> {
	// Note: playlists are not removed by this, one could be left behind empty
	if (rundownIds.length > 0) {
		await Promise.allSettled([
			asyncCollectionRemove(Rundowns, { _id: { $in: rundownIds } }),
			asyncCollectionRemove(AdLibActions, { rundownId: { $in: rundownIds } }),
			asyncCollectionRemove(AdLibPieces, { rundownId: { $in: rundownIds } }),
			asyncCollectionRemove(ExpectedMediaItems, { rundownId: { $in: rundownIds } }),
			asyncCollectionRemove(ExpectedPlayoutItems, { rundownId: { $in: rundownIds } }),
			asyncCollectionRemove(IngestDataCache, { rundownId: { $in: rundownIds } }),
			asyncCollectionRemove(RundownBaselineAdLibPieces, { rundownId: { $in: rundownIds } }),
			asyncCollectionRemove(Segments, { rundownId: { $in: rundownIds } }),
			asyncCollectionRemove(Parts, { rundownId: { $in: rundownIds } }),
			asyncCollectionRemove(PartInstances, { rundownId: { $in: rundownIds } }),
			asyncCollectionRemove(Pieces, { startRundownId: { $in: rundownIds } }),
			asyncCollectionRemove(PieceInstances, { rundownId: { $in: rundownIds } }),
			asyncCollectionRemove(RundownBaselineAdLibActions, { rundownId: { $in: rundownIds } }),
			asyncCollectionRemove(RundownBaselineObjs, { rundownId: { $in: rundownIds } }),
		])
	}
}
