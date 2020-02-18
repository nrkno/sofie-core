import { RundownPlaylists, RundownPlaylist } from '../../../lib/collections/RundownPlaylists'

export function areThereActiveRundownPlaylistsInStudio (studioId: string, excludeRundownPlaylistId?: string): RundownPlaylist[] {
	let anyOtherActiveRundowns = RundownPlaylists.find({
		studioId: studioId,
		active: true,
		_id: {
			$ne: excludeRundownPlaylistId || ''
		}
	}).fetch()

	return anyOtherActiveRundowns
}
