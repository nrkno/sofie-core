import { StudioId } from '../../lib/collections/Studios'
import { RundownPlaylists, RundownPlaylistId } from '../../lib/collections/RundownPlaylists'
import { RundownId, Rundowns } from '../../lib/collections/Rundowns'
import { removeRundownPlaylistFromCache } from './playout/lib'
import { waitForPromise, getHash, protectString, asyncCollectionRemove } from '../../lib/lib'
import { initCacheForRundownPlaylist } from '../cache/DatabaseCaches'
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

export function removeEmptyPlaylists(studioId: StudioId) {
	const playlistsInStudio = RundownPlaylists.find({
		studioId: studioId,
	}).fetch()
	const rundowns = Rundowns.find({
		playlistId: { $in: playlistsInStudio.map((p) => p._id) },
	}).fetch()

	_.each(playlistsInStudio, (playlist) => {
		if (rundowns.filter((r) => r.playlistId === playlist._id).length === 0) {
			// playlist is empty, remove it:

			const cache = waitForPromise(initCacheForRundownPlaylist(playlist))
			removeRundownPlaylistFromCache(cache, playlist)
			waitForPromise(cache.saveAllToDatabase())
		}
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

	await Promise.all([asyncCollectionRemove(RundownPlaylists, { _id: playlistId }), removeRundownsFromDb(rundownIds)])
}
export async function removeRundownsFromDb(rundownIds: RundownId[]): Promise<void> {
	// Note: playlists are not removed by this, one could be left behind empty
	if (rundownIds.length > 0) {
		await Promise.all([
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
