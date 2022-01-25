import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import {
	PeripheralDeviceCategory,
	PeripheralDevices,
	PeripheralDeviceType,
} from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceContentWriteAccess } from '../security/peripheralDevice'
import { StudioContentAccess } from '../security/studio'

export namespace PackageManagerAPI {
	export async function restartExpectation(
		access: PeripheralDeviceContentWriteAccess.ContentAccess,
		workId: string
	): Promise<void> {
		await PeripheralDeviceAPI.executeFunction(access.deviceId, 'restartExpectation', workId)
	}
	export async function abortExpectation(
		access: PeripheralDeviceContentWriteAccess.ContentAccess,
		workId: string
	): Promise<any> {
		await PeripheralDeviceAPI.executeFunction(access.deviceId, 'abortExpectation', workId)
	}

	export async function restartAllExpectationsInStudio(access: StudioContentAccess): Promise<void> {
		const packageManagerDevices = PeripheralDevices.find({
			studioId: access.studioId,
			category: PeripheralDeviceCategory.PACKAGE_MANAGER,
			type: PeripheralDeviceType.PACKAGE_MANAGER,
			subType: PeripheralDeviceAPI.SUBTYPE_PROCESS,
		}).fetch()

		await Promise.all(
			packageManagerDevices.map(async (packageManagerDevice) => {
				return PeripheralDeviceAPI.executeFunction(packageManagerDevice._id, 'restartAllExpectations')
			})
		)
	}
	export async function restartPackageContainer(
		access: PeripheralDeviceContentWriteAccess.ContentAccess,
		containerId: string
	): Promise<void> {
		await PeripheralDeviceAPI.executeFunction(access.deviceId, 'restartPackageContainer', containerId)
	}
}
