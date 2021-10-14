import { check } from '../../lib/check'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import {
	PeripheralDeviceCategory,
	PeripheralDeviceId,
	PeripheralDevices,
	PeripheralDeviceType,
} from '../../lib/collections/PeripheralDevices'
import { MethodContext } from '../../lib/api/methods'
import { PeripheralDeviceContentWriteAccess } from '../security/peripheralDevice'
import { StudioId } from '../../lib/collections/Studios'
import { StudioContentWriteAccess } from '../security/studio'

export namespace PackageManagerAPI {
	export async function restartExpectation(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		workId: string
	): Promise<void> {
		check(deviceId, String)
		check(workId, String)
		PeripheralDeviceContentWriteAccess.peripheralDevice(context, deviceId)

		await PeripheralDeviceAPI.executeFunctionAsync(deviceId, 'restartExpectation', workId)
	}
	export async function restartAllExpectations(context: MethodContext, deviceId: PeripheralDeviceId): Promise<void> {
		check(deviceId, String)
		PeripheralDeviceContentWriteAccess.peripheralDevice(context, deviceId)

		await PeripheralDeviceAPI.executeFunctionAsync(deviceId, 'restartAllExpectations')
	}
	export async function abortExpectation(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		workId: string
	): Promise<any> {
		check(deviceId, String)
		check(workId, String)
		PeripheralDeviceContentWriteAccess.peripheralDevice(context, deviceId)

		await PeripheralDeviceAPI.executeFunctionAsync(deviceId, 'abortExpectation', workId)
	}
	export async function restartAllExpectationsInStudio(context: MethodContext, studioId: StudioId): Promise<void> {
		check(studioId, String)
		StudioContentWriteAccess.anyContent(context, studioId)

		const packageManagerDevices = PeripheralDevices.find({
			studioId: studioId,
			category: PeripheralDeviceCategory.PACKAGE_MANAGER,
			type: PeripheralDeviceType.PACKAGE_MANAGER,
			subType: PeripheralDeviceAPI.SUBTYPE_PROCESS,
		}).fetch()

		await Promise.all(
			packageManagerDevices.map(async (packageManagerDevice) => {
				return restartAllExpectations(context, packageManagerDevice._id)
			})
		)
	}
	export async function restartPackageContainer(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		containerId: string
	): Promise<void> {
		check(deviceId, String)
		check(containerId, String)
		PeripheralDeviceContentWriteAccess.peripheralDevice(context, deviceId)

		await PeripheralDeviceAPI.executeFunctionAsync(deviceId, 'restartPackageContainer', containerId)
	}
}
