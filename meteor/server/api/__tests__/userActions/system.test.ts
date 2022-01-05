import { Meteor } from 'meteor/meteor'
import { ConfigManifestEntryType } from '../../../../lib/api/deviceConfig'
import { PeripheralDeviceAPI } from '../../../../lib/api/peripheralDevice'
import { PeripheralDevice, PeripheralDevices } from '../../../../lib/collections/PeripheralDevices'
import {
	DefaultEnvironment,
	setupDefaultStudioEnvironment,
	setupMockPeripheralDevice,
} from '../../../../__mocks__/helpers/database'
import { testInFiber } from '../../../../__mocks__/helpers/jest'

require('../../userActions') // include in order to create the Meteor methods needed

namespace UserActionAPI {
	// Using our own method definition, to catch external API changes
	export enum methods {
		'disablePeripheralSubDevice' = 'userAction.system.disablePeripheralSubDevice',
	}
}

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
	testInFiber('disable existing subDevice', () => {
		expect(
			Meteor.call(UserActionAPI.methods.disablePeripheralSubDevice, 'e', pDevice._id, mockSubDeviceId, true)
		).toMatchObject({
			success: 200,
		})

		const peripheralDevice = PeripheralDevices.findOne(pDevice._id)
		expect(peripheralDevice).toBeDefined()
		expect(peripheralDevice?.settings).toBeDefined()
		expect(peripheralDevice?.settings && peripheralDevice?.settings['devices'][mockSubDeviceId].disable).toBe(true)
	})
	testInFiber('enable existing subDevice', () => {
		{
			expect(
				Meteor.call(UserActionAPI.methods.disablePeripheralSubDevice, 'e', pDevice._id, mockSubDeviceId, true)
			).toMatchObject({
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
			expect(
				Meteor.call(UserActionAPI.methods.disablePeripheralSubDevice, 'e', pDevice._id, mockSubDeviceId, false)
			).toMatchObject({
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
	testInFiber('edit missing subDevice throws an error', () => {
		{
			expect(() =>
				Meteor.call(
					UserActionAPI.methods.disablePeripheralSubDevice,
					'e',
					pDevice._id,
					'nonExistentSubDevice',
					true
				)
			).toThrowError(/is not configured/)
		}
	})
	testInFiber('edit missing device throws an error', () => {
		{
			expect(() =>
				Meteor.call(
					UserActionAPI.methods.disablePeripheralSubDevice,
					'e',
					'nonExistentDevice',
					'nonExistentSubDevice',
					true
				)
			).toThrowError(/not found/)
		}
	})
	testInFiber("edit device that doesn't support the disable property throws an error", () => {
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

		{
			expect(() =>
				Meteor.call(
					UserActionAPI.methods.disablePeripheralSubDevice,
					'e',
					pDeviceUnsupported._id,
					mockSubDeviceId,
					true
				)
			).toThrowError(/does not support the disable property/)
		}
	})
})
