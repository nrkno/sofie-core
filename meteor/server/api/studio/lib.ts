import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { StudioId } from '../../../lib/collections/Studios'
import { protectString } from '../../../lib/lib'
import { RundownPlaylists } from '../../serverCollections'

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
