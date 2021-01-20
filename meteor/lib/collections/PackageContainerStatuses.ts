import { TransformedCollection } from '../typings/meteor'
import { registerCollection, ProtectedString, Time, protectString } from '../lib'
import { createMongoCollection } from './lib'
import { StudioId } from './Studios'
import { registerIndex } from '../database'
import { ExpectedPackageStatusAPI } from '@sofie-automation/blueprints-integration'
import { ExpectedPackageDB } from './ExpectedPackages'

/*
  The PackageContainers collection contains statuses about PackageContainers
*/

export type PackageContainerId = ProtectedString<'PackageContainerId'>

export interface PackageContainerStatus {
	_id: PackageContainerId // unique id, see getPackageContainerId()

	/** The studio this PackageContainer is defined in */
	studioId: StudioId

	/** Contains information about packages that exists in the PackageContainer */
	packages: {
		[packageId: string]: PackageContainerPackageStatus
	}
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

	modified: Time
}
export enum PackageContainerPackageStatusStatus {
	NOT_READY = 'not_ready',
	TRANSFERRING = 'transferring',
	READY = 'ready',
}

export const PackageContainerStatuses: TransformedCollection<
	PackageContainerStatus,
	PackageContainerStatus
> = createMongoCollection<PackageContainerStatus>('packageContainerStatuses')
registerCollection('PackageContainerStatuses', PackageContainerStatuses)

registerIndex(PackageContainerStatuses, {
	studioId: 1,
})

export function getPackageContainerId(studioId: StudioId, packageContainerId: string): PackageContainerId {
	return protectString(`${studioId}_${packageContainerId}`)
}
