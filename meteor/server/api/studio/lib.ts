import { RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PackageInfoDB } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { getCurrentTime, protectString } from '../../../lib/lib'
import { PackageInfos, PeripheralDevices, RundownPlaylists } from '../../collections'

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
export async function getRemovedPackageInfos(): Promise<PackageInfoDB['_id'][]> {
	const docs = await PackageInfos.findFetchAsync({ removeTime: { $lte: getCurrentTime() } }, { fields: { _id: 1 } })
	return docs.map((p) => p._id)
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
