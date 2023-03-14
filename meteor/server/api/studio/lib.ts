import { RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PackageInfoDB } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'
import { ExpectedPackages } from '../../../lib/collections/ExpectedPackages'
import { PackageInfos } from '../../../lib/collections/PackageInfos'
import { RundownPlaylist, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { getCurrentTime, protectString } from '../../../lib/lib'

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

/** Returns a list of PackageInfos which are no longer valid */
export async function getRemovedOrOrphanedPackageInfos(): Promise<PackageInfoDB['_id'][]> {
	const knownExpectedPackageIds = (await ExpectedPackages.findFetchAsync({}, { fields: { _id: 1 } })).map(
		(pkg) => pkg._id
	)

	const docs = await PackageInfos.findFetchAsync(
		{
			$or: [
				{
					// Marked for delayed removal, and that time has passed
					removeTime: { $lte: getCurrentTime() },
				},
				{
					// Not marked for delayed removal, and the expectedPackage has been deleted
					packageId: { $nin: knownExpectedPackageIds },
					removeTime: { $exists: false },
				},
			],
		},
		{
			fields: {
				_id: 1,
			},
		}
	)
	return docs.map((p) => p._id)
}
