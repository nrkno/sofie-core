import {
	ensureSourceLayer,
	ensureMapping,
	ensureStudioConfig,
	ensureDeviceVersion,
	removeMapping
} from './lib'
import { SourceLayerType } from 'tv-automation-sofie-blueprints-integration'
import {
	DeviceType as PlayoutDeviceType,
	MappingPanasonicPtz,
	MappingPanasonicPtzType
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
import { literal } from '../../lib/lib'
import { MappingExt, StudioInstallations } from '../../lib/collections/StudioInstallations'
import { LookaheadMode } from '../../lib/api/playout'

// 0.18.0: Release 4
addMigrationSteps( '0.18.0', [
	removeMapping('nora_permanent_klokke'),
	removeMapping('nora_permanent_logo'),
	ensureMapping('nora_primary_klokke', literal<MappingExt>({
		device: PlayoutDeviceType.HTTPSEND,
		deviceId: 'http0',
		lookahead: LookaheadMode.NONE,
	})),
	ensureMapping('nora_primary_logo', literal<MappingExt>({
		device: PlayoutDeviceType.HTTPSEND,
		deviceId: 'http0',
		lookahead: LookaheadMode.NONE,
	})),
	removeMapping('casparcg_cg_permanent'),
	{
		id: 'mapping.casparcg_player_wipe.lookahead',
		canBeRunAutomatically: true,
		validate: () => {
			let studio = StudioInstallations.findOne()
			if (!studio) return 'Studio not found'

			let dbMapping = studio.mappings['casparcg_player_wipe']
			if (!dbMapping) return false

			if (dbMapping.lookahead !== LookaheadMode.PRELOAD) return `Mapping "casparcg_player_wipe" wrong lookahead mode`

			return false
		},
		migrate: () => {
			let studio = StudioInstallations.findOne()
			if (!studio) return 'Studio not found'

			let dbMapping = studio.mappings['casparcg_player_wipe']

			if (dbMapping) { // only update if the mapping does exist
				let m = {}
				m['mappings.casparcg_player_wipe.lookahead'] = LookaheadMode.PRELOAD
				logger.info(`Migration: Updating Studio mapping "casparcg_player_wipe" in ${studio._id}`)
				StudioInstallations.update(studio._id, {$set: m})
			}
		}
	},
	ensureSourceLayer({
		_id: 'studio0_host_light',
		_rank: 0,
		name: 'HostLight',
		type: SourceLayerType.LIGHTS,
		onPGMClean: false,
		activateKeyboardHotkeys: '',
		assignHotkeysToGlobalAdlibs: false,
		unlimited: false,
		isHidden: true // or should it be?
	}),
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
	ensureMapping('pharos_lights', literal<MappingExt>({
		device: PlayoutDeviceType.PHAROS,
		deviceId: 'pharos0',
		lookahead: LookaheadMode.NONE,
	})),
	ensureMapping('ptz0_zoom', literal<MappingPanasonicPtz & MappingExt>({
		device: PlayoutDeviceType.PANASONIC_PTZ,
		deviceId: 'ptz0',
		mappingType: MappingPanasonicPtzType.ZOOM,
		lookahead: LookaheadMode.NONE,
	})),
	ensureMapping('ptz0_zoom_speed', literal<MappingPanasonicPtz & MappingExt>({
		device: PlayoutDeviceType.PANASONIC_PTZ,
		deviceId: 'ptz0',
		mappingType: MappingPanasonicPtzType.ZOOM_SPEED,
		lookahead: LookaheadMode.NONE,
	})),
	ensureStudioConfig('ApningCameraInitialZoom', 0),
	ensureStudioConfig('ApningCameraZoomSpeed', 0.1),
	ensureStudioConfig('ApningCameraZoomDuration', 3000),
	ensureStudioConfig('SluttCameraInitialZoom', 1),
	ensureStudioConfig('SluttCameraZoomSpeed', -0.1),
	ensureStudioConfig('SluttCameraZoomDuration', 3000),
	ensureDeviceVersion('ensureVersion.playoutDevice', PeripheralDeviceAPI.DeviceType.PLAYOUT, '_process', '0.13.0'),
	ensureDeviceVersion('ensureVersion.mosDevice', PeripheralDeviceAPI.DeviceType.MOSDEVICE, '_process', '0.4.2'),
	ensureSourceLayer({
		_id: 'studio0_audio_bed',
		_rank: 0,
		name: 'Bed',
		type: SourceLayerType.AUDIO,
		onPGMClean: true,
		activateKeyboardHotkeys: '',
		assignHotkeysToGlobalAdlibs: false,
		unlimited: false,
		isHidden: true
	})
])
