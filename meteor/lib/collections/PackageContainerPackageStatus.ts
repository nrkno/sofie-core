import { TransformedCollection } from '../typings/meteor'
import { registerCollection, ProtectedString, Time, protectString } from '../lib'
import { createMongoCollection } from './lib'
import { StudioId } from './Studios'
import { registerIndex } from '../database'
import { ExpectedPackageStatusAPI } from '@sofie-automation/blueprints-integration'
import { ExpectedPackageDB, ExpectedPackageId } from './ExpectedPackages'

/*
  The PackageContainerPackage collection contains statuses about "a Package on a PackageContainer"
*/

export type PackageContainerId = ProtectedString<'PackageContainerId'>

export interface PackageContainerPackageStatusDB {
	_id: PackageContainerId // unique id, see getPackageContainerPackageId()

	/** The studio this PackageContainer is defined in */
	studioId: StudioId

	/** The PackageContainer the package is in */
	containerId: string

	/** The Package this status is for */
	packageId: string

	/** The status of the Package */
	status: PackageContainerPackageStatus

	modified: Time
}

export interface PackageContainerPackageStatus extends Omit<ExpectedPackageStatusAPI.WorkStatusInfo, 'status'> {
	status: PackageContainerPackageStatusStatus

	contentVersionHash: string

	/* Progress (0-1), used when status = TRANSFERRING */
	progress: number
	/** Calculated time left, used when status = TRANSFERRING */
	expectedLeft?: number

	/** Longer reason as to why the status is what it is */
	statusReason: string
}
export enum PackageContainerPackageStatusStatus {
	NOT_READY = 'not_ready',
	TRANSFERRING = 'transferring',
	READY = 'ready',
}

export const PackageContainerPackageStatuses: TransformedCollection<
	PackageContainerPackageStatusDB,
	PackageContainerPackageStatusDB
> = createMongoCollection<PackageContainerPackageStatusDB>('packageContainerStatuses')
registerCollection('PackageContainerStatuses', PackageContainerPackageStatuses)

registerIndex(PackageContainerPackageStatuses, {
	studioId: 1,
	containerId: 1,
	packageId: 1,
})

export function getPackageContainerPackageId(
	studioId: StudioId,
	containerId: string,
	packageId: string | ExpectedPackageId
): PackageContainerId {
	return protectString(`${studioId}_${containerId}_${packageId}`)
}
