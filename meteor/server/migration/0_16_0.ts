import {
	ensureStudioConfig,
	ensureDeviceVersion
} from './lib'
import {
	DeviceType as PlayoutDeviceType,
} from 'timeline-state-resolver-types'
import { addMigrationSteps } from './databaseMigration'
import { getCoreSystem, setCoreSystemStorePath } from '../../lib/collections/CoreSystem'
import * as _ from 'underscore'
import {
	PeripheralDevices,
	PlayoutDeviceSettings,
	PlayoutDeviceSettingsDeviceHyperdeck,
	PlayoutDeviceSettingsDevicePanasonicPTZ
} from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { logger } from '../logging'

/**
 * This file contains system specific migration steps.
 * These files are combined with / overridden by migration steps defined in the blueprints.
 */

// 0.16.0: Release 3
addMigrationSteps( '0.16.0', [
	// Todo: Mos-gateway version
	// Todo: Playout-gateway version
	// Todo: Blueprints version

	ensureStudioConfig('slack_evaluation', null, 'text', 'Studio $id config: slack_evaluation',
		'Enter the URL to the Slack webhook (example: "https://hooks.slack.com/services/WEBHOOKURL"'),

	{
		id: 'CoreSystem.storePath',
		canBeRunAutomatically: false,
		validate: () => {
			let system = getCoreSystem()
			if (!system) return 'CoreSystem not found!'
			if (!system.storePath) return 'CoreSystem.storePath not set!'
			if (!_.isString(system.storePath)) return 'CoreSystem.storePath must be a string!'
			if (system.storePath.slice(-1) === '/') return 'CoreSystem.storePath must not end with "/"!'
			return false
		},
		migrate: (input) => {
			setCoreSystemStorePath(input.storePath)
		},
		input: [{
			label: 'File path for persistant storage',
			description: 'Enter the file path for the persistant storage (example "/mnt/drive/sofie")',
			inputType: 'text',
			attribute: 'storePath'
		}]
	},

	// To be moved to blueprints:
	{
		id: 'Playout-gateway.hyperdeck0',
		canBeRunAutomatically: false,
		validate: () => {
			let device = PeripheralDevices.findOne({type: PeripheralDeviceAPI.DeviceType.PLAYOUT})
			if (!device) return 'Playout-gateway not found'
			let settings = device.settings || {devices: {}} as PlayoutDeviceSettings

			let hyperdeck0 = settings.devices['hyperdeck0'] as PlayoutDeviceSettingsDeviceHyperdeck
			if (!hyperdeck0) return '"hyperdeck0" missing'
			// @ts-ignore
			if (!hyperdeck0.options) hyperdeck0.options = {}
			if (hyperdeck0.type !== PlayoutDeviceType.HYPERDECK) return 'Type is not "HYPERDECK"'
			if (!hyperdeck0.options.host) return 'Host is not set'
			if (!hyperdeck0.options.port) return 'Port is not set'

			return false
		},
		migrate: () => {
			let device = PeripheralDevices.findOne({type: PeripheralDeviceAPI.DeviceType.PLAYOUT})
			if (device) {
				// Set some default values:
				let hyperdeck0 = device.settings && device.settings.devices['hyperdeck0']
				if (!hyperdeck0) {
					logger.info(`Migration: Add PeripheralDevice.settings to ${device._id}: hyperdeck0`)
					PeripheralDevices.update(device._id, {$set: {
						'settings.devices.hyperdeck0': {
							type: PlayoutDeviceType.HYPERDECK,
							options: {
								host: '',
								port: 9993,
							}
						}
					}})
				}
			}
		},
		input: [{
			label: 'Playout-gateway: device "hyperdeck0" not set up',
			description: 'Go into the settings of the Playout-gateway and setup the device "hyperdeck0". ($validation)',
			inputType: null,
			attribute: null
		}]
	},
	{
		id: 'Playout-gateway.ptz0',
		canBeRunAutomatically: false,
		validate: () => {
			let device = PeripheralDevices.findOne({type: PeripheralDeviceAPI.DeviceType.PLAYOUT})
			if (!device) return 'Playout-gateway not found'
			let settings = device.settings || {devices: {}} as PlayoutDeviceSettings

			let ptz0 = settings.devices['ptz0'] as PlayoutDeviceSettingsDevicePanasonicPTZ
			if (!ptz0) return '"ptz0" missing'
			// @ts-ignore
			if (!ptz0.options) ptz0.options = {}
			if (ptz0.type !== PlayoutDeviceType.PANASONIC_PTZ) return 'Type is not "PANASONIC_PTZ"'
			// let cameraDevices = ptz0.options.cameraDevices

			return false
		},
		migrate: () => {
			let device = PeripheralDevices.findOne({type: PeripheralDeviceAPI.DeviceType.PLAYOUT})
			if (device) {
				// Set some default values:
				let ptz0 = device.settings && device.settings.devices['ptz0']
				if (!ptz0) {
					logger.info(`Migration: Add PeripheralDevice.settings to ${device._id}: ptz0`)
					PeripheralDevices.update(device._id, {$set: {
						'settings.devices.ptz0': {
							type: PlayoutDeviceType.PANASONIC_PTZ,
							options: {
								cameraDevices: []
							}
						}
					}})
				}
			}
		},
		input: [{
			label: 'Playout-gateway: device "ptz0" not set up',
			description: 'Go into the settings of the Playout-gateway and setup the device "ptz0". ($validation)',
			inputType: null,
			attribute: null
		}]
	},
	ensureDeviceVersion('ensureVersion.mosDevice', PeripheralDeviceAPI.DeviceType.MOSDEVICE, '_process', '0.1.1')
])
