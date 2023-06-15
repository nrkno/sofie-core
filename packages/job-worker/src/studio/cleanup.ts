import { runJobWithPlaylistLock } from '../playout/lock'
import { JobContext } from '../jobs'
import { runJobWithStudioCache } from './lock'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'

/**
 * Cleanup any RundownPlaylists that contain no Rundowns
 */
export async function handleRemoveEmptyPlaylists(context: JobContext, _data: void): Promise<void> {
	await runJobWithStudioCache(context, async (cache) => {
		// Skip any playlists which are active
		const tmpPlaylists = cache.RundownPlaylists.findAll((p) => !p.activationId, { fields: { _id: 1 } })

		// We want to run them all in parallel
		await Promise.allSettled(
			tmpPlaylists.map(async (tmpPlaylist) =>
				// Take the playlist lock, to ensure we don't fight something else
				runJobWithPlaylistLock(context, { playlistId: tmpPlaylist._id }, async (playlist) => {
					if (playlist) {
						const rundowns: Pick<DBRundown, '_id'>[] = await context.directCollections.Rundowns.findFetch(
							{ playlistId: playlist._id },
							{ projection: { _id: 1 } }
						)
						if (rundowns.length === 0) {
							await context.directCollections.RundownPlaylists.remove({ _id: playlist._id }, null)
						}
					}
				})
			)
		)
	})
}
