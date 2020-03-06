import { RundownPlaylists, RundownPlaylist, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { StudioId } from '../../../lib/collections/Studios'
import { protectString } from '../../../lib/lib'

export function areThereActiveRundownPlaylistsInStudio (studioId: StudioId, excludeRundownPlaylistId?: RundownPlaylistId): RundownPlaylist[] {
	let anyOtherActiveRundowns = RundownPlaylists.find({
		studioId: studioId,
		active: true,
		_id: {
			$ne: excludeRundownPlaylistId || protectString('')
		}
	}).fetch()

	return anyOtherActiveRundowns
}
