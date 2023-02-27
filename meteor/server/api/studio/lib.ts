import { RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownPlaylist, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { protectString } from '../../../lib/lib'

export async function getActiveRundownPlaylistsInStudioFromDb(
	studioId: StudioId,
	excludeRundownPlaylistId?: RundownPlaylistId
): Promise<RundownPlaylist[]> {
	return RundownPlaylists.findFetchAsync({
		studioId: studioId,
		activationId: { $exists: true },
		_id: {
			$ne: excludeRundownPlaylistId || protectString(''),
		},
	})
}
