import * as _ from 'underscore'
import { check } from '../../../lib/check'
import { Meteor } from 'meteor/meteor'
import { PeripheralDeviceId } from '../../../lib/collections/PeripheralDevices'
import { MethodContext } from '../../../lib/api/methods'
import { checkAccessAndGetPeripheralDevice } from '../ingest/lib'
import { ExpectedPackages } from '../../../lib/collections/ExpectedPackages'
import { ExpectedPackageStatusAPI } from '@sofie-automation/blueprints-integration'
import {
	ExpectedPackageWorkStatus,
	ExpectedPackageWorkStatuses,
	ExpectedPackageWorkStatusId,
} from '../../../lib/collections/ExpectedPackageStatuses'
import { getCurrentTime, protectStringObject } from '../../../lib/lib'

export namespace PackageManagerIntegration {
	export function insertExpectedPackageWorkStatus(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		packageStatusId: ExpectedPackageWorkStatusId,
		packageStatus0: ExpectedPackageStatusAPI.PackageStatus
	): void {
		const packageStatus = protectStringObject<ExpectedPackageStatusAPI.PackageStatus, 'packageId'>(packageStatus0)

		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		if (!peripheralDevice.studioId)
			throw new Meteor.Error(400, 'Device "' + peripheralDevice._id + '" has no studio')

		check(packageStatus.packageId, String)
		const expPackage = ExpectedPackages.findOne(packageStatus.packageId)
		if (!expPackage) throw new Meteor.Error(404, `ExpectedPackage "${packageStatus.packageId}" not found`)

		const doc: ExpectedPackageWorkStatus = {
			...packageStatus,

			_id: packageStatusId,
			studioId: expPackage.studioId,
			rundownId: expPackage.rundownId,
			pieceId: expPackage.pieceId,
			deviceId: peripheralDevice._id,

			modified: getCurrentTime(),
		}
		ExpectedPackageWorkStatuses.upsert(packageStatusId, { $set: doc })
	}
	/**
	 * Update ExpectedPackageStatus
	 * Returns true if update successful, false if the document to update isn't found (ie an insert should then be sent as well)
	 */
	export function updateExpectedPackageWorkStatus(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		packageStatusId: ExpectedPackageWorkStatusId,
		packageStatus0: Partial<ExpectedPackageStatusAPI.PackageStatus>
	): boolean {
		const packageStatus = protectStringObject<Partial<ExpectedPackageStatusAPI.PackageStatus>, 'packageId'>(
			packageStatus0
		)
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		if (!peripheralDevice.studioId)
			throw new Meteor.Error(400, 'Device "' + peripheralDevice._id + '" has no studio')

		check(packageStatusId, String)
		check(packageStatus, Object)

		// Update progress only:

		const updateCount = ExpectedPackageWorkStatuses.update(packageStatusId, {
			$set: {
				...packageStatus,
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
		packageStatusId: ExpectedPackageWorkStatusId
	): void {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		check(packageStatusId, String)

		ExpectedPackageWorkStatuses.remove({
			_id: packageStatusId,
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
}
