import {
	RundownPlaylist,
	RundownPlaylistId,
	DBRundownPlaylist,
	RundownPlaylists,
} from '../../../lib/collections/RundownPlaylists'
import { StudioId } from '../../../lib/collections/Studios'
import { protectString } from '../../../lib/lib'
import { CacheForStudio } from '../../DatabaseCaches'
import { MongoSelector } from '../../../lib/typings/meteor'

export function getActiveRundownPlaylistsInStudio(
	cache: CacheForStudio | null,
	studioId: StudioId,
	excludeRundownPlaylistId?: RundownPlaylistId
): RundownPlaylist[] {
	const q: MongoSelector<DBRundownPlaylist> = {
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
