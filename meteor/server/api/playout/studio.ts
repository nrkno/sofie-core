import {
	DBRundownPlaylist,
	RundownPlaylist,
	RundownPlaylistId,
	RundownPlaylists,
} from '../../../lib/collections/RundownPlaylists'
import { StudioId } from '../../../lib/collections/Studios'
import { protectString } from '../../../lib/lib'
import { MongoQuery } from '../../../lib/typings/meteor'
import { CacheForStudio } from '../../DatabaseCaches'

export function getActiveRundownPlaylistsInStudio(
	cache: CacheForStudio | null,
	studioId: StudioId,
	excludeRundownPlaylistId?: RundownPlaylistId
): RundownPlaylist[] {
	const q: MongoQuery<DBRundownPlaylist> = {
		studioId: studioId,
		active: true,
		_id: {
			$ne: excludeRundownPlaylistId || protectString(''),
		},
	}
	if (!cache) {
		return RundownPlaylists.find(q).fetch()
	} else {
		return cache.RundownPlaylists.findFetch(q)
	}
}
