import {
	ensureDeviceVersion
} from './lib'
import {
	DeviceType as PlayoutDeviceType,
} from 'timeline-state-resolver-types'
import { addMigrationSteps } from './databaseMigration'
import * as _ from 'underscore'
import {
	PeripheralDevices,
	PlayoutDeviceSettings,
	PlayoutDeviceSettingsDevicePharos
} from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { logger } from '../logging'

// 0.18.0: Release 4
addMigrationSteps( '0.18.0', [
	{
		id: 'Playout-gateway.pharos0',
		canBeRunAutomatically: false,
		validate: () => {
			let device = PeripheralDevices.findOne({type: PeripheralDeviceAPI.DeviceType.PLAYOUT})
			if (!device) return 'Playout-gateway not found'
			let settings = device.settings || {devices: {}} as PlayoutDeviceSettings

			let pharos0 = settings.devices['pharos0'] as PlayoutDeviceSettingsDevicePharos
			if (!pharos0) return '"pharos0" missing'
			// @ts-ignore
			if (!pharos0.options) pharos0.options = {}
			if (pharos0.type !== PlayoutDeviceType.PHAROS) return 'Type is not "PHAROS"'
			// let cameraDevices = pharos0.options.cameraDevices

			return false
		},
		migrate: () => {
			let device = PeripheralDevices.findOne({type: PeripheralDeviceAPI.DeviceType.PLAYOUT})
			if (device) {
				// Set some default values:
				let pharos0 = device.settings && device.settings.devices['pharos0']
				if (!pharos0) {
					logger.info(`Migration: Add PeripheralDevice.settings to ${device._id}: pharos0`)
					PeripheralDevices.update(device._id, {$set: {
						'settings.devices.pharos0': {
							type: PlayoutDeviceType.PHAROS,
							options: {
								host: ''
							}
						}
					}})
				}
			}
		},
		input: [{
			label: 'Playout-gateway: device "pharos0" not set up',
			description: 'Go into the settings of the Playout-gateway and setup the device "pharos0". ($validation)',
			inputType: null,
			attribute: null
		}]
	},

	ensureDeviceVersion('ensureVersion.playoutDevice', PeripheralDeviceAPI.DeviceType.PLAYOUT, '_process', '0.13.0'),
	ensureDeviceVersion('ensureVersion.mosDevice', PeripheralDeviceAPI.DeviceType.MOSDEVICE, '_process', '0.4.2'),
])
