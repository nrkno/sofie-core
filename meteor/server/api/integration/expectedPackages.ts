import * as _ from 'underscore'
import { check } from '../../../lib/check'
import { Meteor } from 'meteor/meteor'
import { PeripheralDeviceId } from '../../../lib/collections/PeripheralDevices'
import { MethodContext } from '../../../lib/api/methods'
import { checkAccessAndGetPeripheralDevice } from '../ingest/lib'
import { ExpectedPackageId, ExpectedPackages } from '../../../lib/collections/ExpectedPackages'
import { ExpectedPackageStatusAPI } from '@sofie-automation/blueprints-integration'
import {
	ExpectedPackageWorkStatus,
	ExpectedPackageWorkStatuses,
	ExpectedPackageWorkStatusId,
} from '../../../lib/collections/ExpectedPackageWorkStatuses'
import { getCurrentTime, literal, protectStringObject } from '../../../lib/lib'
import {
	getPackageContainerId,
	PackageContainerPackageStatus,
	PackageContainerStatus,
	PackageContainerStatuses,
} from '../../../lib/collections/PackageContainerStatuses'
import { getPackageInfoId, PackageInfoBase, PackageInfoDB, PackageInfos } from '../../../lib/collections/PackageInfos'

export namespace PackageManagerIntegration {
	export function insertExpectedPackageWorkStatus(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		workStatusId: ExpectedPackageWorkStatusId,
		workStatus0: ExpectedPackageStatusAPI.WorkStatus
	): void {
		const workStatus = (workStatus0 as any) as Omit<ExpectedPackageStatusAPI.WorkStatus, 'fromPackages'> & {
			fromPackages: { id: ExpectedPackageId; contentVersionHash: string }[]
		}

		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		if (!peripheralDevice.studioId)
			throw new Meteor.Error(400, 'Device "' + peripheralDevice._id + '" has no studio')

		check(workStatus.fromPackages, Array)
		const fromPackageIds = workStatus.fromPackages.map((p) => p.id)
		const expPackage = ExpectedPackages.findOne({ _id: { $in: fromPackageIds } })
		if (!expPackage) throw new Meteor.Error(404, `ExpectedPackages "${fromPackageIds}" not found`)

		const doc: ExpectedPackageWorkStatus = {
			...workStatus,

			_id: workStatusId,
			studioId: expPackage.studioId,
			// rundownId: expPackage.rundownId,
			// pieceId: expPackage.pieceId,
			deviceId: peripheralDevice._id,

			modified: getCurrentTime(),
		}
		ExpectedPackageWorkStatuses.upsert(workStatusId, { $set: doc })
	}
	/**
	 * Update ExpectedPackageWorkStatus
	 * Returns true if update successful, false if the document to update isn't found (ie an insert should then be sent as well)
	 */
	export function updateExpectedPackageWorkStatus(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		workStatusId: ExpectedPackageWorkStatusId,
		workStatus0: Partial<ExpectedPackageStatusAPI.WorkStatus>
	): boolean {
		const workStatus = (workStatus0 as any) as Omit<
			Partial<ExpectedPackageStatusAPI.WorkStatus>,
			'fromPackages'
		> & {
			fromPackages?: { id: ExpectedPackageId; contentVersionHash: string }[]
		}

		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		if (!peripheralDevice.studioId)
			throw new Meteor.Error(400, 'Device "' + peripheralDevice._id + '" has no studio')

		check(workStatusId, String)
		check(workStatus, Object)

		// Update progress only:

		const updateCount = ExpectedPackageWorkStatuses.update(workStatusId, {
			$set: {
				...workStatus,
				modified: getCurrentTime(),
			},
		})
		if (updateCount === 0) return false // No document found, insertExpectedPackageStatus should be called by the device
		return true
	}
	export function removeExpectedPackageWorkStatus(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		workStatusId: ExpectedPackageWorkStatusId
	): void {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		check(workStatusId, String)

		ExpectedPackageWorkStatuses.remove({
			_id: workStatusId,
			deviceId: peripheralDevice._id,
		})
	}
	export function removeAllExpectedPackageWorkStatusOfDevice(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string
	): void {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)

		ExpectedPackageWorkStatuses.remove({
			deviceId: peripheralDevice._id,
		})
	}

	export function updatePackageContainerPackageStatus(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		containerId: string,
		packageId: string,
		packageStatus: PackageContainerPackageStatus | null
	): void {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		if (!peripheralDevice.studioId)
			throw new Meteor.Error(400, 'Device "' + peripheralDevice._id + '" has no studio')
		check(containerId, String)
		check(packageId, String)

		const id = getPackageContainerId(peripheralDevice.studioId, containerId)

		if (packageStatus) {
			const mod = {}
			mod[`packages.${packageId}`] = packageStatus

			const updateCount = PackageContainerStatuses.update(id, { $set: mod })
			if (updateCount === 0) {
				// The PackageContainerStatus doesn't exist
				// Create it on the fly:

				PackageContainerStatuses.upsert(id, {
					$set: literal<Omit<PackageContainerStatus, 'packages'>>({
						_id: id,
						studioId: peripheralDevice.studioId,
						[`packages.${packageId}`]: packageStatus,
					}),
				})
			}
		} else {
			// removed

			const mod = {}
			mod[`packages.${packageId}`] = 1
			PackageContainerStatuses.update(id, { $unset: mod })
		}
	}
	export function fetchPackageInfoMetadata(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		type: string,
		packageIds: ExpectedPackageId[]
	): { packageId: ExpectedPackageId; expectedContentVersionHash: string; actualContentVersionHash: string }[] {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		check(packageIds, Array)
		check(type, String)
		if (!peripheralDevice.studioId)
			throw new Meteor.Error(400, 'Device "' + peripheralDevice._id + '" has no studio')

		const ids = packageIds.map((packageId) => getPackageInfoId(packageId, type))
		const packageInfos = PackageInfos.find(
			{ _id: { $in: ids } },
			{
				fields: {
					payload: 0,
				},
			}
		).fetch()
		return packageInfos.map((packageInfo) => ({
			packageId: packageInfo.packageId,
			expectedContentVersionHash: packageInfo.expectedContentVersionHash,
			actualContentVersionHash: packageInfo.actualContentVersionHash,
		}))
	}
	export function updatePackageInfo(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		type: string,
		packageId: ExpectedPackageId,
		expectedContentVersionHash: string,
		actualContentVersionHash: string,
		payload: any
	): void {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		check(packageId, String)
		check(type, String)
		if (!peripheralDevice.studioId)
			throw new Meteor.Error(400, 'Device "' + peripheralDevice._id + '" has no studio')

		const id = getPackageInfoId(packageId, type)

		PackageInfos.upsert(id, {
			$set: literal<PackageInfoBase>({
				_id: id,

				packageId: packageId,
				expectedContentVersionHash: expectedContentVersionHash,
				actualContentVersionHash: actualContentVersionHash,

				studioId: peripheralDevice.studioId,

				deviceId: peripheralDevice._id,

				type: type,
				payload: payload,
			}) as PackageInfoDB,
		})
	}
	export function removePackageInfo(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		type: string,
		packageId: ExpectedPackageId
	): void {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		check(packageId, String)
		check(type, String)
		if (!peripheralDevice.studioId)
			throw new Meteor.Error(400, 'Device "' + peripheralDevice._id + '" has no studio')

		const id = getPackageInfoId(packageId, type)

		PackageInfos.remove(id)
	}
}
