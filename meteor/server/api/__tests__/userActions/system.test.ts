import { ConfigManifestEntryType } from '../../../../lib/api/deviceConfig'
import { MeteorCall } from '../../../../lib/api/methods'
import { PeripheralDeviceAPI } from '../../../../lib/api/peripheralDevice'
import { PeripheralDevice, PeripheralDevices } from '../../../../lib/collections/PeripheralDevices'
import { protectString } from '../../../../lib/lib'
import {
	DefaultEnvironment,
	setupDefaultStudioEnvironment,
	setupMockPeripheralDevice,
} from '../../../../__mocks__/helpers/database'
import '../../../../__mocks__/_extendJest'
import { testInFiber } from '../../../../__mocks__/helpers/jest'

require('../../userActions') // include in order to create the Meteor methods needed

describe('User Actions - Disable Peripheral SubDevice', () => {
	let env: DefaultEnvironment
	let pDevice: PeripheralDevice
	const mockSubDeviceId = 'mockSubDevice0'

	beforeEach(async () => {
		const organizationId = null
		env = await setupDefaultStudioEnvironment(organizationId)
		pDevice = setupMockPeripheralDevice(
			PeripheralDeviceAPI.DeviceCategory.PLAYOUT,
			PeripheralDeviceAPI.DeviceType.PLAYOUT,
			PeripheralDeviceAPI.SUBTYPE_PROCESS,
			env.studio,
			{
				organizationId,
				settings: {
					devices: {
						[mockSubDeviceId]: {
							type: 'dummy',
							disable: false,
						},
					},
				},
				configManifest: {
					deviceConfig: [
						{
							id: 'devices',
							type: ConfigManifestEntryType.TABLE,
							isSubDevices: true,
							defaultType: 'dummy',
							typeField: 'type',
							name: 'Devices',
							config: {
								dummy: [
									{
										id: 'disable',
										type: ConfigManifestEntryType.BOOLEAN,
										name: 'Disable',
									},
								],
							},
						},
					],
				},
			}
		)
		jest.resetAllMocks()
	})
	testInFiber('disable existing subDevice', async () => {
		await expect(
			MeteorCall.userAction.disablePeripheralSubDevice('e', pDevice._id, mockSubDeviceId, true)
		).resolves.toMatchObject({
			success: 200,
		})

		const peripheralDevice = PeripheralDevices.findOne(pDevice._id)
		expect(peripheralDevice).toBeDefined()
		expect(peripheralDevice?.settings).toBeDefined()
		expect(peripheralDevice?.settings && peripheralDevice?.settings['devices'][mockSubDeviceId].disable).toBe(true)
	})
	testInFiber('enable existing subDevice', async () => {
		{
			await expect(
				MeteorCall.userAction.disablePeripheralSubDevice('e', pDevice._id, mockSubDeviceId, true)
			).resolves.toMatchObject({
				success: 200,
			})

			const peripheralDevice = PeripheralDevices.findOne(pDevice._id)
			expect(peripheralDevice).toBeDefined()
			expect(peripheralDevice?.settings).toBeDefined()
			expect(peripheralDevice?.settings && peripheralDevice?.settings['devices'][mockSubDeviceId].disable).toBe(
				true
			)
		}

		{
			await expect(
				MeteorCall.userAction.disablePeripheralSubDevice('e', pDevice._id, mockSubDeviceId, false)
			).resolves.toMatchObject({
				success: 200,
			})

			const peripheralDevice = PeripheralDevices.findOne(pDevice._id)
			expect(peripheralDevice).toBeDefined()
			expect(peripheralDevice?.settings).toBeDefined()
			expect(peripheralDevice?.settings && peripheralDevice?.settings['devices'][mockSubDeviceId].disable).toBe(
				false
			)
		}
	})
	testInFiber('edit missing subDevice throws an error', async () => {
		await expect(
			MeteorCall.userAction.disablePeripheralSubDevice('e', pDevice._id, 'nonExistentSubDevice', true)
		).rejects.toMatchToString(/is not configured/)
	})
	testInFiber('edit missing device throws an error', async () => {
		await expect(
			MeteorCall.userAction.disablePeripheralSubDevice(
				'e',
				protectString('nonExistentDevice'),
				'nonExistentSubDevice',
				true
			)
		).rejects.toMatchToString(/not found/)
	})
	testInFiber("edit device that doesn't support the disable property throws an error", async () => {
		const pDeviceUnsupported = setupMockPeripheralDevice(
			PeripheralDeviceAPI.DeviceCategory.PLAYOUT,
			PeripheralDeviceAPI.DeviceType.PLAYOUT,
			PeripheralDeviceAPI.SUBTYPE_PROCESS,
			env.studio,
			{
				organizationId: null,
				settings: {
					devices: {
						[mockSubDeviceId]: {
							type: 'dummy',
							disable: false,
						},
					},
				},
				configManifest: {
					deviceConfig: [
						{
							id: 'devices',
							type: ConfigManifestEntryType.TABLE,
							isSubDevices: true,
							defaultType: 'dummy',
							typeField: 'type',
							name: 'Devices',
							config: {
								dummy: [
									{
										id: 'disable',
										type: ConfigManifestEntryType.STRING,
										name: 'A property mislabeled as Disable',
									},
								],
							},
						},
					],
				},
			}
		)

		await expect(
			MeteorCall.userAction.disablePeripheralSubDevice('e', pDeviceUnsupported._id, mockSubDeviceId, true)
		).rejects.toMatchToString(/does not support the disable property/)
	})
})
