import { RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { JobContext } from '../jobs'

export async function getActiveRundownPlaylistsInStudioFromDb(
	context: JobContext,
	studioId: StudioId,
	excludeRundownPlaylistId?: RundownPlaylistId
): Promise<DBRundownPlaylist[]> {
	return context.directCollections.RundownPlaylists.findFetch({
		studioId: studioId,
		activationId: { $exists: true },
		_id: {
			$ne: excludeRundownPlaylistId || protectString(''),
		},
	})
}
