import { RundownPlaylist, RundownPlaylistId, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { StudioId } from '../../../lib/collections/Studios'
import { protectString } from '../../../lib/lib'

export function getActiveRundownPlaylistsInStudioFromDb(
	studioId: StudioId,
	excludeRundownPlaylistId?: RundownPlaylistId
): RundownPlaylist[] {
	return RundownPlaylists.find({
		studioId: studioId,
		activationId: { $exists: true },
		_id: {
			$ne: excludeRundownPlaylistId || protectString(''),
		},
	}).fetch()
}
