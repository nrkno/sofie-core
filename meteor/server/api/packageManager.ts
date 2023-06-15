import {
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	PERIPHERAL_SUBTYPE_PROCESS,
} from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceContentWriteAccess } from '../security/peripheralDevice'
import { StudioContentAccess } from '../security/studio'
import { PeripheralDevices } from '../collections'
import { executePeripheralDeviceFunction } from './peripheralDevice/executeFunction'

export namespace PackageManagerAPI {
	export async function restartExpectation(
		access: PeripheralDeviceContentWriteAccess.ContentAccess,
		workId: string
	): Promise<void> {
		await executePeripheralDeviceFunction(access.deviceId, 'restartExpectation', workId)
	}
	export async function abortExpectation(
		access: PeripheralDeviceContentWriteAccess.ContentAccess,
		workId: string
	): Promise<any> {
		await executePeripheralDeviceFunction(access.deviceId, 'abortExpectation', workId)
	}

	export async function restartAllExpectationsInStudio(access: StudioContentAccess): Promise<void> {
		const packageManagerDevices = await PeripheralDevices.findFetchAsync({
			studioId: access.studioId,
			category: PeripheralDeviceCategory.PACKAGE_MANAGER,
			type: PeripheralDeviceType.PACKAGE_MANAGER,
			subType: PERIPHERAL_SUBTYPE_PROCESS,
		})

		await Promise.all(
			packageManagerDevices.map(async (packageManagerDevice) => {
				return executePeripheralDeviceFunction(packageManagerDevice._id, 'restartAllExpectations')
			})
		)
	}
	export async function restartPackageContainer(
		access: PeripheralDeviceContentWriteAccess.ContentAccess,
		containerId: string
	): Promise<void> {
		await executePeripheralDeviceFunction(access.deviceId, 'restartPackageContainer', containerId)
	}
}
