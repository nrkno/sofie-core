import { registerCollection, ProtectedString, Time, protectString } from '../lib'
import { createMongoCollection } from './lib'
import { StudioId } from './Studios'
import { registerIndex } from '../database'
import { ExpectedPackageStatusAPI } from '@sofie-automation/blueprints-integration'
import { PeripheralDeviceId } from './PeripheralDevices'

/**
 * The PackageContainerStatuses-collection contains statuses about PackageContainers
 * PackageContainerStatuses are populated by the Package Manager-device and are used to track
 * jobs that runs on the PackageContainer, such as cronjobs and monitors
 *
 * Note: A "Package Container" is a generic term for "something that contains packages".
 * One  example of this could be a Media-folder (the "package container") which contains Media-files ("packages").
 */

/** Id of a package container */
export type PackageContainerId = ProtectedString<'PackageContainerId'>

export interface PackageContainerStatusDB {
	_id: PackageContainerId // unique id, see getPackageContainerId()

	/** The studio this PackageContainer is defined in */
	studioId: StudioId

	/** The id of the PackageContainer */
	containerId: string

	/** Which PeripheralDevice this update came from */
	deviceId: PeripheralDeviceId

	/** The status of the PackageContainer */
	status: ExpectedPackageStatusAPI.PackageContainerStatus

	modified: Time
}

export const PackageContainerStatuses = createMongoCollection<PackageContainerStatusDB, PackageContainerStatusDB>(
	'packageContainerStatuses'
)
registerCollection('PackageContainerStatuses', PackageContainerStatuses)

registerIndex(PackageContainerStatuses, {
	studioId: 1,
	containerId: 1,
})
registerIndex(PackageContainerStatuses, {
	deviceId: 1,
})

export function getPackageContainerId(studioId: StudioId, containerId: string): PackageContainerId {
	return protectString(`${studioId}_${containerId}`)
}
