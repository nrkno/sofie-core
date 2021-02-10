import {
	RundownPlaylist,
	RundownPlaylistId,
	DBRundownPlaylist,
	RundownPlaylists,
} from '../../../lib/collections/RundownPlaylists'
import { StudioId } from '../../../lib/collections/Studios'
import { protectString } from '../../../lib/lib'
import { MongoQuery } from '../../../lib/typings/meteor'

export function getActiveRundownPlaylistsInStudioFromDb(
	studioId: StudioId,
	excludeRundownPlaylistId?: RundownPlaylistId
): RundownPlaylist[] {
	const q: MongoQuery<DBRundownPlaylist> = {
		studioId: studioId,
		activationId: { $exists: true },
		_id: {
			$ne: excludeRundownPlaylistId || protectString(''),
		},
	}
	return RundownPlaylists.find(q).fetch()
}
