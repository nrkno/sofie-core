import { addMigrationSteps } from './databaseMigration'
import { logger } from '../logging'
import { SourceLayerType } from 'tv-automation-sofie-blueprints-integration'
import { RunningOrderAPI } from '../../lib/api/runningOrder'
import { StudioInstallations } from '../../lib/collections/StudioInstallations'
import {
	ChannelFormat,
	MappingCasparCG,
	TimelineObjCCGRecord, TimelineContentTypeCasparCg, TimelineObjCCGInput,
	DeviceType as PlayoutDeviceType
} from 'timeline-state-resolver-types'
import { LookaheadMode } from '../../lib/api/playout'
import { ensureCollectionProperty, ensureStudioConfig } from './lib'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { PeripheralDevices, PlayoutDeviceSettings, PlayoutDeviceSettingsDevice, PlayoutDeviceSettingsDeviceCasparCG, PlayoutDeviceSettingsDeviceAtem } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'

/**
 * This file contains system specific migration steps.
 * These files are combined with / overridden by migration steps defined in the blueprints.
 */

// 0.1.0: These are the "default" migration steps
addMigrationSteps( '0.1.0', [
	{
		id: 'studio exists',
		canBeRunAutomatically: true,
		validate: () => {
			if (!StudioInstallations.findOne()) return 'No StudioInstallation found'
			return false
		},
		migrate: () => {
			// create default studio
			logger.info(`Migration: Add default studio`)
			StudioInstallations.insert({
				_id: 'studio0',
				name: 'Default studio',
				defaultShowStyleVariant: 'variant0',
				supportedShowStyleBase: ['show0'],
				// defaultShowStyle: 'show0', // deprecated
				settings: {
					mediaPreviewsUrl: '',
					sofieUrl: ''
				},
				mappings: {
					'layer0': {
						device: PlayoutDeviceType.CASPARCG,
						lookahead: LookaheadMode.NONE,
						deviceId: 'casparcg0'
					}
				},
				config: [
					{
						_id: 'nora_group',
						value: 'dksl'
					},
					{
						_id: 'nora_apikey',
						value: ''
					},
					{
						_id: 'slack_evaluation',
						value: ''
					}
				]
			})
		}
	},
	ensureCollectionProperty('StudioInstallations', {}, 'name', null, 'text', 'Studio $id: Name',
		'Enter the Name of the Studio "$id"'),
	// ensureCollectionProperty('StudioInstallations', {}, 'defaultShowStyle', null, 'text', 'Studio $id: Default ShowStyle',
	// 	'Enter the Default show style id for this Studio'), // Deprecated
	// ensureCollectionProperty('StudioInstallations', {}, 'outputLayers', []), // Deprecated
	// ensureCollectionProperty('StudioInstallations', {}, 'sourceLayers', []), // Deprecated
	ensureCollectionProperty('StudioInstallations', {}, 'mappings', {}),
	ensureCollectionProperty('StudioInstallations', {}, 'config', []),
	ensureCollectionProperty('StudioInstallations', {}, 'settings', {}),
	ensureCollectionProperty('StudioInstallations', {}, 'settings.mediaPreviewsUrl', ''),

	/*
	// ShowStyles collection has been depracated and split into ShowStyleBase & ShowStyleVariant
	ensureCollectionProperty('ShowStyles', {}, 'name', null, 'text', 'ShowStyle $id: Name', 'Enter the Name of the ShowStyles "$id"'),
	ensureCollectionProperty('ShowStyles', {}, 'templateMappings', []),
	// ensureCollectionProperty('ShowStyles', {}, 'baselineTemplate', ''),
	// ensureCollectionProperty('ShowStyles', {}, 'messageTemplate', ''),
	// ensureCollectionProperty('ShowStyles', {}, 'routerBlueprint', ''),
	// ensureCollectionProperty('ShowStyles', {}, 'postProcessBlueprint', ''),
	// Studio configs:
	// ensureStudioConfig('media_previews_url', null, 'text', 'Studio $id config: media_previews_url',
	// 	'Enter the url to the Media-previews endpoint (exposed by the CasparCG-Launcher), example: "http://192.168.0.1:8000/"', 'http://IP-ADDRESS:8000/'),
	ensureStudioConfig('sofie_url', null, 'text', 'Studio $id config: sofie_url',
		'Enter the url to this Sofie-application (it\'s the url in your browser), example: "http://sofie01"', 'http://URL-TO-SOFIE'),
	*/

	{
		id: 'playoutDevice exists',
		canBeRunAutomatically: true,
		validate: () => {
			if (!PeripheralDevices.findOne({
				type: PeripheralDeviceAPI.DeviceType.PLAYOUT
			})) return 'No Playout-device found'
			return false
		},
		// Note: No migrate() function, user must fix this him/herself
		input: [{
			label: 'Sofie needs at least one playout-device',
			description: 'Start up and connect with at least one Playout-gateway',
			inputType: null,
			attribute: null
		}]
	},
	// ---------------------------------------------------------------
	// ---------------------------------------------------------------
	// To be moved into Blueprints:
	// ---------------------------------------------------------------
	// ---------------------------------------------------------------
	ensureStudioConfig('atemSSrcBackground', null, 'text', 'Studio $id config: atemSSrcBackground',
		'Enter the file path to ATEM SuperSource Background, example: "/opt/playout-gateway/static/atem-mp/split_overlay.rgba"'),
	ensureStudioConfig('atemSSrcBackground2', null, 'text', 'Studio $id config: atemSSrcBackground2',
		'Enter the file path to ATEM SuperSource Background 2, example: "/opt/playout-gateway/static/atem-mp/teknisk_feil.rgba"'),
	ensureStudioConfig('nora_group', null, 'text', 'Studio $id config: nora_group',
		'Enter the nora_group paramter, example: "dksl"'),
	ensureStudioConfig('nora_apikey', null, 'text', 'Studio $id config: nora_apikey',
		'Enter the nora_apikey parameter'),
	ensureStudioConfig('metadata_url', null, 'text', 'Studio $id config: metadata_url',
		'Enter the URL to the send metadata to'),
	ensureStudioConfig('sources_kam', null, 'text', 'Studio $id config: sources_kam',
		'Enter the sources_kam parameter (example: "1:1,2:2,3:3,4:4,8:11,9:12"'),
	ensureStudioConfig('sources_rm', null, 'text', 'Studio $id config: sources_rm',
		'Enter the sources_rm parameter (example: "1:5,2:6,3:7,4:8,5:9,6:10"'),
	{
		id: 'Playout-gateway exists',
		canBeRunAutomatically: false,
		validate: () => {
			if (!PeripheralDevices.findOne({type: PeripheralDeviceAPI.DeviceType.PLAYOUT})) return 'Playout-gateway not found'
			return false
		},
		// Note: No migrate() function, user must fix this him/herself
		input: [{
			label: 'Playout-device 0 not set up',
			description: 'Start up the Playout-gateway and make sure it\'s connected to Sofie',
			inputType: null,
			attribute: null
		}]
	},
	{
		id: 'Mos-gateway exists',
		canBeRunAutomatically: false,
		validate: () => {
			if (!PeripheralDevices.findOne({type: PeripheralDeviceAPI.DeviceType.MOSDEVICE})) return 'Mos-gateway not found'
			return false
		},
		// Note: No migrate() function, user must fix this him/herself
		input: [{
			label: 'Mos-device 0 not set up',
			description: 'Start up the Mos-gateway and make sure it\'s connected to Sofie',
			inputType: null,
			attribute: null
		}]
	},
	{
		id: 'Playout-gateway.abstract0',
		canBeRunAutomatically: false,
		validate: () => {
			let device = PeripheralDevices.findOne({type: PeripheralDeviceAPI.DeviceType.PLAYOUT})
			if (!device) return 'Playout-gateway not found'
			let settings = device.settings || {devices: {}} as PlayoutDeviceSettings

			let abstract0 = settings.devices['abstract0'] as PlayoutDeviceSettingsDevice
			if (!abstract0) return '"abstract0" missing'
			if (abstract0.type !== PlayoutDeviceType.ABSTRACT) return 'Type is not "ABSTRACT"'

			return false
		},
		migrate: () => {
			let device = PeripheralDevices.findOne({type: PeripheralDeviceAPI.DeviceType.PLAYOUT})
			if (device) {
				// Set some default values:
				let abstract0 = device.settings && device.settings.devices['abstract0']
				if (!abstract0) {
					logger.info(`Migration: Add PeripheralDevice.settings to ${device._id}: abstract0`)
					PeripheralDevices.update(device._id, {$set: {
						'settings.devices.abstract0': {
							type: PlayoutDeviceType.ABSTRACT,
							options: {}
						}
					}})
				}
			}
		},
		input: [{
			label: 'Playout-gateway: device "abstract0" not set up',
			description: 'Go into the settings of the Playout-gateway and setup the device "abstract0". ($validation)',
			inputType: null,
			attribute: null
		}]
	},
	{
		id: 'Playout-gateway.casparcg0',
		canBeRunAutomatically: false,
		validate: () => {
			let device = PeripheralDevices.findOne({type: PeripheralDeviceAPI.DeviceType.PLAYOUT})
			if (!device) return 'Playout-gateway not found'
			let settings = device.settings || {devices: {}} as PlayoutDeviceSettings

			let casparcg0 = settings.devices['casparcg0'] as PlayoutDeviceSettingsDeviceCasparCG
			if (!casparcg0) return '"casparcg0" missing'

			// @ts-ignore
			if (!casparcg0.options) casparcg0.options = {}
			if (casparcg0.type !== PlayoutDeviceType.CASPARCG) return 'Type is not "CASPARCG"'
			if (!casparcg0.options.host) return 'Host is not set'
			if (!casparcg0.options.launcherHost) return 'Launcher host is not set'

			return false
		},
		migrate: () => {
			let device = PeripheralDevices.findOne({type: PeripheralDeviceAPI.DeviceType.PLAYOUT})
			if (device) {
				// Set some default values:
				let casparcg0 = device.settings && device.settings.devices['casparcg0']
				if (!casparcg0) {
					logger.info(`Migration: Add PeripheralDevice.settings to ${device._id}: casparcg0`)
					PeripheralDevices.update(device._id, {$set: {
						'settings.devices.casparcg0': {
							type: PlayoutDeviceType.CASPARCG,
							options: {
								host: '127.0.0.1',
								port: 5250,
								launcherHost: '127.0.0.1',
								launcherPort: 8010, // todo: change this
							}
						}
					}})
				}
			}
		},
		input: [{
			label: 'Playout-gateway: device "casparcg0" not set up',
			description: 'Go into the settings of the Playout-gateway and setup the device "casparcg0". ($validation)',
			inputType: null,
			attribute: null
		}]
	},
	{
		id: 'Playout-gateway.casparcg1',
		canBeRunAutomatically: false,
		validate: () => {
			let device = PeripheralDevices.findOne({type: PeripheralDeviceAPI.DeviceType.PLAYOUT})
			if (!device) return 'Playout-gateway not found'
			let settings = device.settings || {devices: {}} as PlayoutDeviceSettings

			let casparcg1 = settings.devices['casparcg1'] as PlayoutDeviceSettingsDeviceCasparCG
			if (!casparcg1) return '"casparcg1" missing'

			// @ts-ignore
			if (!casparcg1.options) casparcg1.options = {}
			if (casparcg1.type !== PlayoutDeviceType.CASPARCG) return 'Type is not "CASPARCG"'
			if (!casparcg1.options.host) return 'Host is not set'
			if (!casparcg1.options.launcherHost) return 'Launcher host is not set'

			return false
		},
		migrate: () => {
			let device = PeripheralDevices.findOne({type: PeripheralDeviceAPI.DeviceType.PLAYOUT})
			if (device) {
				// Set some default values:
				let casparcg1 = device.settings && device.settings.devices['casparcg1']
				if (!casparcg1) {
					logger.info(`Migration: Add PeripheralDevice.settings to ${device._id}: casparcg1`)
					PeripheralDevices.update(device._id, {$set: {
						'settings.devices.casparcg1': {
							type: PlayoutDeviceType.CASPARCG,
							options: {
								host: '127.0.0.1',
								port: 5250,
								launcherHost: '127.0.0.1',
								launcherPort: 8010, // todo: change this
							}
						}
					}})
				}
			}
		},
		input: [{
			label: 'Playout-gateway: device "casparcg1" not set up',
			description: 'Go into the settings of the Playout-gateway and setup the device "casparcg1". ($validation)',
			inputType: null,
			attribute: null
		}]
	},
	{
		id: 'Playout-gateway.atem0',
		canBeRunAutomatically: false,
		validate: () => {
			let device = PeripheralDevices.findOne({type: PeripheralDeviceAPI.DeviceType.PLAYOUT})
			if (!device) return 'Playout-gateway not found'
			let settings = device.settings || {devices: {}} as PlayoutDeviceSettings

			let atem0 = settings.devices['atem0'] as PlayoutDeviceSettingsDeviceAtem
			if (!atem0) return '"atem0" missing'
			if (atem0.type !== PlayoutDeviceType.ATEM) return 'Type is not "ATEM"'
			if (!atem0.options.host) return 'Host is not set'

			return false
		},
		migrate: () => {
			let device = PeripheralDevices.findOne({type: PeripheralDeviceAPI.DeviceType.PLAYOUT})
			if (device) {
				// Set some default values:
				let atem0 = device.settings && device.settings.devices['atem0']
				if (!atem0) {
					logger.info(`Migration: Add PeripheralDevice.settings to ${device._id}: atem0`)
					PeripheralDevices.update(device._id, {$set: {
						'settings.devices.atem0': {
							type: PlayoutDeviceType.ATEM,
							options: {
								host: '',
								port: 9910,
							}
						}
					}})
				}
			}
		},
		input: [{
			label: 'Playout-gateway: device "atem0" not set up',
			description: 'Go into the settings of the Playout-gateway and setup the device "atem0". ($validation)',
			inputType: null,
			attribute: null
		}]
	},
	{
		id: 'Playout-gateway.http0',
		canBeRunAutomatically: false,
		validate: () => {
			let device = PeripheralDevices.findOne({type: PeripheralDeviceAPI.DeviceType.PLAYOUT})
			if (!device) return 'Playout-gateway not found'
			let settings = device.settings || {devices: {}} as PlayoutDeviceSettings

			let http0 = settings.devices['http0'] as PlayoutDeviceSettingsDevice
			if (!http0) return '"http0" missing'
			if (http0.type !== PlayoutDeviceType.HTTPSEND) return 'Type is not "HTTPSEND"'

			return false
		},
		migrate: () => {
			let device = PeripheralDevices.findOne({type: PeripheralDeviceAPI.DeviceType.PLAYOUT})
			if (device) {
				// Set some default values:
				let http0 = device.settings && device.settings.devices['http0']
				if (!http0) {
					logger.info(`Migration: Add PeripheralDevice.settings to ${device._id}: http0`)
					PeripheralDevices.update(device._id, {$set: {
						'settings.devices.http0': {
							type: PlayoutDeviceType.HTTPSEND,
							options: {
								host: '',
								port: 9910,
							}
						}
					}})
				}
			}
		},
		input: [{
			label: 'Playout-gateway: device "http0" not set up',
			description: 'Go into the settings of the Playout-gateway and setup the device "http0". ($validation)',
			inputType: null,
			attribute: null
		}]
	},
	{
		id: 'Playout-gateway.lawo0',
		canBeRunAutomatically: false,
		validate: () => {
			let device = PeripheralDevices.findOne({type: PeripheralDeviceAPI.DeviceType.PLAYOUT})
			if (!device) return 'Playout-gateway not found'
			let settings = device.settings || {devices: {}} as PlayoutDeviceSettings

			let lawo0 = settings.devices['lawo0'] as PlayoutDeviceSettingsDevice
			if (!lawo0) return '"lawo0" missing'
			if (lawo0.type !== PlayoutDeviceType.LAWO) return 'Type is not "LAWO"'

			return false
		},
		migrate: () => {
			let device = PeripheralDevices.findOne({type: PeripheralDeviceAPI.DeviceType.PLAYOUT})
			if (device) {
				// Set some default values:
				let lawo0 = device.settings && device.settings.devices['lawo0']
				if (!lawo0) {
					logger.info(`Migration: Add PeripheralDevice.settings to ${device._id}: lawo0`)
					PeripheralDevices.update(device._id, {$set: {
						'settings.devices.lawo0': {
							type: PlayoutDeviceType.LAWO,
							options: {
								host: '',
								port: 9910,
							}
						}
					}})
				}
			}
		},
		input: [{
			label: 'Playout-gateway: device "lawo0" not set up',
			description: 'Go into the settings of the Playout-gateway and setup the device "lawo0". ($validation)',
			inputType: null,
			attribute: null
		}]
	},
])
