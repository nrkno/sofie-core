import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceCommands } from '../../lib/collections/PeripheralDeviceCommands'
import { MediaWorkFlows } from '../../lib/collections/MediaWorkFlows'
import { MediaWorkFlowSteps } from '../../lib/collections/MediaWorkFlowSteps'
import { ExpectedPackageWorkStatuses } from '../../lib/collections/ExpectedPackageWorkStatuses'
import { PackageContainerPackageStatuses } from '../../lib/collections/PackageContainerPackageStatus'
import { PackageInfos } from '../../lib/collections/PackageInfos'
import { Rundowns } from '../../lib/collections/Rundowns'
import { BucketAdLibActions } from '../../lib/collections/BucketAdlibActions'
import { BucketAdLibs } from '../../lib/collections/BucketAdlibs'
import { Buckets } from '../../lib/collections/Buckets'
import { Evaluations } from '../../lib/collections/Evaluations'
import { ExpectedMediaItems } from '../../lib/collections/ExpectedMediaItems'
import { ExpectedPackages } from '../../lib/collections/ExpectedPackages'
import { ExpectedPlayoutItems } from '../../lib/collections/ExpectedPlayoutItems'
import { ExternalMessageQueue } from '../../lib/collections/ExternalMessageQueue'
import { MediaObjects } from '../../lib/collections/MediaObjects'
import { RundownPlaylists } from '../../lib/collections/RundownPlaylists'
import { Timeline } from '../../lib/collections/Timeline'
import { Studios } from '../../lib/collections/Studios'
import { handleRemovedRundownByRundown } from './ingest/rundownInput'
import { runStudioOperationWithCache, StudioLockFunctionPriority } from './studio/lockFunction'
import { removeRundownPlaylistFromDb } from './rundownPlaylist'

export async function cleanupOldData(): Promise<number> {
	let count = 0
	count += await removeOwnedByPeripheralDevices()
	count += await removeOwnedByStudios()
	count += await removeOldData()

	return count
}

export async function removeOwnedByPeripheralDevices(): Promise<number> {
	let count = 0
	const ps: Promise<void>[] = []
	const existingPeripheralDeviceIds = PeripheralDevices.find()
		.fetch()
		.map((d) => d._id)

	count += PeripheralDevices.remove({ parentDeviceId: { $nin: existingPeripheralDeviceIds } })
	count += PeripheralDeviceCommands.remove({ deviceId: { $nin: existingPeripheralDeviceIds } })
	count += ExpectedPackageWorkStatuses.remove({ deviceId: { $nin: existingPeripheralDeviceIds } })
	count += MediaWorkFlows.remove({ deviceId: { $nin: existingPeripheralDeviceIds } })
	count += MediaWorkFlowSteps.remove({ deviceId: { $nin: existingPeripheralDeviceIds } })
	count += PackageContainerPackageStatuses.remove({ deviceId: { $nin: existingPeripheralDeviceIds } })
	count += PackageInfos.remove({ deviceId: { $nin: existingPeripheralDeviceIds } })

	Rundowns.find({ deviceId: { $nin: existingPeripheralDeviceIds } }).forEach((rundown) => {
		ps.push(handleRemovedRundownByRundown(rundown))
		count++
	})

	await Promise.all(ps)

	return count
}
export async function removeOwnedByStudios(): Promise<number> {
	let count = 0
	const ps: Promise<void>[] = []
	const existingStudioIds = Studios.find()
		.fetch()
		.map((d) => d._id)

	BucketAdLibActions.remove({ studioId: { $nin: existingStudioIds } })
	BucketAdLibs.remove({ studioId: { $nin: existingStudioIds } })
	Buckets.remove({ studioId: { $nin: existingStudioIds } })
	Evaluations.remove({ studioId: { $nin: existingStudioIds } })
	ExpectedMediaItems.remove({ studioId: { $nin: existingStudioIds } })
	ExpectedPackages.remove({ studioId: { $nin: existingStudioIds } })
	ExpectedPackageWorkStatuses.remove({ studioId: { $nin: existingStudioIds } })
	ExpectedPlayoutItems.remove({ studioId: { $nin: existingStudioIds } })
	ExternalMessageQueue.remove({ studioId: { $nin: existingStudioIds } })
	MediaObjects.remove({ studioId: { $nin: existingStudioIds } })
	MediaWorkFlows.remove({ studioId: { $nin: existingStudioIds } })
	MediaWorkFlowSteps.remove({ studioId: { $nin: existingStudioIds } })
	PackageContainerPackageStatuses.remove({ studioId: { $nin: existingStudioIds } })
	PackageInfos.remove({ studioId: { $nin: existingStudioIds } })
	PeripheralDevices.remove({ studioId: { $nin: existingStudioIds } })
	Rundowns.remove({ studioId: { $nin: existingStudioIds } })
	Timeline.remove({ studioId: { $nin: existingStudioIds } })

	RundownPlaylists.find({ studioId: { $nin: existingStudioIds } }).forEach((playlist) => {
		ps.push(
			runStudioOperationWithCache(
				'removeEmptyPlaylists',
				playlist.studioId,
				StudioLockFunctionPriority.MISC,
				async (_cache) => {
					await removeRundownPlaylistFromDb(playlist)
				}
			)
		)

		count++
	})

	await Promise.all(ps)

	return count
}

export async function removeOldData(): Promise<number> {
	// to be implemented
}
