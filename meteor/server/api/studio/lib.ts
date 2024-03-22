import { RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PackageInfoDB } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { getCurrentTime, protectString } from '../../../lib/lib'
import { ExpectedPackages, PackageInfos, PeripheralDevices, RundownPlaylists } from '../../collections'

export async function getActiveRundownPlaylistsInStudioFromDb(
	studioId: StudioId,
	excludeRundownPlaylistId?: RundownPlaylistId
): Promise<DBRundownPlaylist[]> {
	return RundownPlaylists.findFetchAsync({
		studioId: studioId,
		activationId: { $exists: true },
		_id: {
			$ne: excludeRundownPlaylistId || protectString(''),
		},
	})
}

/** Returns a list of PackageInfos which have reached their removeTime */
export async function getExpiredRemovedPackageInfos(): Promise<PackageInfoDB['_id'][]> {
	const docs = await PackageInfos.findFetchAsync(
		{
			// Marked for delayed removal, and that time has passed
			removeTime: { $lte: getCurrentTime() },
		},
		{
			fields: {
				_id: 1,
			},
		}
	)
	return docs.map((p) => p._id)
}

/** Returns a list of PackageInfos which are missing their parent ExpectedPackage */
export async function getOrphanedPackageInfos(): Promise<PackageInfoDB['_id'][]> {
	const knownExpectedPackageIds = (await ExpectedPackages.findFetchAsync({}, { fields: { _id: 1 } })).map(
		(pkg) => pkg._id
	)

	const docs = await PackageInfos.findFetchAsync(
		{
			// Not marked for delayed removal, and the expectedPackage has been deleted
			packageId: { $nin: knownExpectedPackageIds },
			removeTime: { $exists: false },
		},
		{
			fields: {
				_id: 1,
			},
		}
	)
	return docs.map((p) => p._id)
}

/** Remove or mark for delayed removal some PackageInfos by id */
export async function removePackageInfos(ids: PackageInfoDB['_id'][], mode: 'defer' | 'purge'): Promise<void> {
	if (mode === 'defer') {
		// Mark for later removal
		const removeDelay = 3600 * 24 // Arbitrary value of 24 hours

		await PackageInfos.updateAsync(
			{
				_id: { $in: ids },
			},
			{
				$set: {
					removeTime: getCurrentTime() + removeDelay,
				},
			}
		)
	} else {
		// Remove now
		await PackageInfos.removeAsync({
			_id: { $in: ids },
		})
	}
}

export async function getStudioIdFromDevice(peripheralDevice: PeripheralDevice): Promise<StudioId | undefined> {
	if (peripheralDevice.studioId) {
		return peripheralDevice.studioId
	}
	if (peripheralDevice.parentDeviceId) {
		// Also check the parent device:
		const parentDevice = (await PeripheralDevices.findOneAsync(peripheralDevice.parentDeviceId, {
			fields: {
				_id: 1,
				studioId: 1,
			},
		})) as Pick<PeripheralDevice, '_id' | 'studioId'> | undefined
		if (parentDevice) {
			return parentDevice.studioId
		}
	}
	return undefined
}
