import { addMigrationStep, MigrationStep, addMigrationSteps, MigrationStepBase } from './databaseMigration'
import { StudioInstallation, StudioInstallations, DBStudioInstallation, ISourceLayer, IOutputLayer, Mapping, MappingHyperdeck, MappingPanasonicPtz, MappingHyperdeckType, MappingPanasonicPtzType } from '../lib/collections/StudioInstallations'
import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import { MigrationStepInput, MigrationStepInputFilteredResult } from '../lib/api/migration'
import { Collections, objectPathGet, literal } from '../lib/lib'
import { Meteor } from 'meteor/meteor'
import { ShowStyles } from '../lib/collections/ShowStyles'
import { RunningOrderAPI } from '../lib/api/runningOrder'
import { PlayoutDeviceType, PeripheralDevices, PlayoutDeviceSettings, PlayoutDeviceSettingsDevice, PlayoutDeviceSettingsDeviceCasparCG, PlayoutDeviceSettingsDeviceAtem, PlayoutDeviceSettingsDeviceHyperdeck, PlayoutDeviceSettingsDevicePanasonicPTZ } from '../lib/collections/PeripheralDevices'
import { LookaheadMode } from '../lib/api/playout'
import { PeripheralDeviceAPI } from '../lib/api/peripheralDevice'
import { compareVersions, parseVersion, getCoreSystem, setCoreSystemStorePath } from '../lib/collections/CoreSystem'
import { logger } from './logging'

/**
 * This file contains all system specific migration steps.
 * These files are combined with / overridden by migration steps defined in the blueprints.
 */

/**
 * Convenience function to generate basic test
 * @param collectionName
 * @param selector
 * @param property
 * @param value
 * @param inputType
 * @param label
 * @param description
 * @param defaultValue
 */
function ensureCollectionProperty<T = any> (
	collectionName: string,
	selector: Mongo.Selector<T>,
	property: string,
	value: any | null, // null if manual
	inputType?: 'text' | 'multiline' | 'int' | 'checkbox' | 'dropdown' | 'switch', // EditAttribute types
	label?: string,
	description?: string,
	defaultValue?: any
): MigrationStepBase {
	let collection: Mongo.Collection<T> = Collections[collectionName]
	if (!collection) throw new Meteor.Error(404, `Collection ${collectionName} not found`)

	return {
		id: `${collectionName}.${property}`,
		canBeRunAutomatically: (_.isNull(value) ? false : true),
		validate: () => {
			let objects = collection.find(selector).fetch()
			let propertyMissing: string | boolean = false
			_.each(objects, (obj: any) => {
				if (!objectPathGet(obj, property)) propertyMissing = `${property} is missing on ${obj._id}`
			})

			return propertyMissing
		},
		input: () => {
			let objects = collection.find(selector).fetch()

			let inputs: Array<MigrationStepInput> = []
			_.each(objects, (obj: any) => {

				let localLabel = (label + '').replace(/\$id/g, obj._id)
				let localDescription = (description + '').replace(/\$id/g, obj._id)
				if (inputType && !obj[property]) {
					inputs.push({
						label: localLabel,
						description: localDescription,
						inputType: inputType,
						attribute: obj._id,
						defaultValue: defaultValue
					})
				}
			})
			return inputs
		},
		migrate: (input: MigrationStepInputFilteredResult) => {

			if (value) {
				let objects = collection.find(selector).fetch()
				_.each(objects, (obj: any) => {
					if (obj && objectPathGet(obj, property) !== value) {
						let m = {}
						m[property] = value
						logger.info(`Migration: Setting ${collectionName} object "${obj._id}".${property} to ${value}`)
						collection.update(obj._id,{$set: m })
					}
				})
			} else {
				_.each(input, (value, objectId: string) => {
					if (!_.isUndefined(value)) {
						let obj = collection.findOne(objectId)
						if (obj && objectPathGet(obj, property) !== value) {
							let m = {}
							m[property] = value
							logger.info(`Migration: Setting ${collectionName} object "${objectId}".${property} to ${value}`)
							collection.update(objectId,{$set: m })
						}
					}
				})
			}
		}
	}
}
function ensureStudioConfig (
	configName: string,
	value: any | null, // null if manual
	inputType?: 'text' | 'multiline' | 'int' | 'checkbox' | 'dropdown' | 'switch', // EditAttribute types
	label?: string,
	description?: string,
	defaultValue?: any
): MigrationStepBase {

	return {
		id: `studioConfig.${configName}`,
		canBeRunAutomatically: (_.isNull(value) ? false : true),
		validate: () => {
			let studios = StudioInstallations.find().fetch()
			let configMissing: string | boolean = false
			_.each(studios, (studio: StudioInstallation) => {
				let config = _.find(studio.config, (c) => {
					return c._id === configName
				})
				if (!config) {
					configMissing = `${configName} is missing on ${studio._id}`
				}
			})

			return configMissing
		},
		input: () => {
			let studios = StudioInstallations.find().fetch()

			let inputs: Array<MigrationStepInput> = []
			_.each(studios, (studio: StudioInstallation) => {
				let config = _.find(studio.config, (c) => {
					return c._id === configName
				})

				let localLabel = (label + '').replace(/\$id/g, studio._id)
				let localDescription = (description + '').replace(/\$id/g, studio._id)
				if (inputType && !studio[configName]) {
					inputs.push({
						label: localLabel,
						description: localDescription,
						inputType: inputType,
						attribute: studio._id,
						defaultValue: config && config.value ? config.value : defaultValue
					})
				}
			})
			return inputs
		},
		migrate: (input: MigrationStepInputFilteredResult) => {

			let studios = StudioInstallations.find().fetch()
			_.each(studios, (studio: StudioInstallation) => {
				let value2: any = undefined
				if (!_.isNull(value)) {
					value2 = value
				} else {
					value2 = input[studio._id]
				}
				if (!_.isUndefined(value2)) {
					let config = _.find(studio.config, (c) => {
						return c._id === configName
					})
					let doUpdate: boolean = false
					if (config) {
						if (config.value !== value2) {
							doUpdate = true
							config.value = value2
						}
					} else {
						doUpdate = true
						studio.config.push({
							_id: configName,
							value: value2
						})
					}
					if (doUpdate) {
						logger.info(`Migration: Setting Studio config "${configName}" to ${value2}`)
						StudioInstallations.update(studio._id,{$set: {
							config: studio.config
						}})
					}
				}
			})
		}
	}
}

function ensureSourceLayer (sourceLayer: ISourceLayer): MigrationStepBase {
	return {
		id: `sourceLayer.${sourceLayer._id}`,
		canBeRunAutomatically: true,
		validate: () => {
			let studio = StudioInstallations.findOne()
			if (!studio) return 'Studio not found'

			let sl = _.find(studio.sourceLayers, (sl) => {
				return sl._id === sourceLayer._id
			})

			if (!sl) return `SourceLayer ${sourceLayer._id} missing`
			return false
		},
		migrate: () => {
			let studio = StudioInstallations.findOne()
			if (!studio) return 'Studio not found'

			let sl = _.find(studio.sourceLayers, (sl) => {
				return sl._id === sourceLayer._id
			})

			if (!sl) {
				logger.info(`Migration: Adding Studio sourceLayer "${sourceLayer._id}" to ${studio._id}`)
				StudioInstallations.update(studio._id, {$push: {
					'sourceLayers': sourceLayer
				}})
			}
		}
	}
}
function ensureOutputLayer (outputLayer: IOutputLayer): MigrationStepBase {
	return {
		id: `outputLayer.${outputLayer._id}`,
		canBeRunAutomatically: true,
		validate: () => {
			let studio = StudioInstallations.findOne()
			if (!studio) return 'Studio not found'

			let sl = _.find(studio.outputLayers, (sl) => {
				return sl._id === outputLayer._id
			})

			if (!sl) return `OutputLayer ${outputLayer._id} missing`
			return false
		},
		migrate: () => {
			let studio = StudioInstallations.findOne()
			if (!studio) return 'Studio not found'

			let sl = _.find(studio.outputLayers, (sl) => {
				return sl._id === outputLayer._id
			})

			if (!sl) {
				logger.info(`Migration: Adding Studio outputLayer "${outputLayer._id}" to ${studio._id}`)
				StudioInstallations.update(studio._id, {$push: {
					'outputLayers': outputLayer
				}})
			}
		}
	}
}
function ensureMapping (mappingId: string, mapping: Mapping): MigrationStepBase {
	return {
		id: `mapping.${mappingId}`,
		canBeRunAutomatically: true,
		validate: () => {
			let studio = StudioInstallations.findOne()
			if (!studio) return 'Studio not found'

			let dbMapping = studio.mappings[mappingId]

			if (!dbMapping) return `Mapping ${mappingId} missing`

			return false
		},
		migrate: () => {
			let studio = StudioInstallations.findOne()
			if (!studio) return 'Studio not found'

			let dbMapping = studio.mappings[mappingId]

			if (!dbMapping) { // only add if the mapping does not exist
				let m = {}
				m['mappings.' + mappingId] = mapping
				logger.info(`Migration: Adding Studio mapping "${mappingId}" to ${studio._id}`)
				StudioInstallations.update(studio._id, {$set: m})
			}
		}
	}
}
function removeMapping (mappingId: string): MigrationStepBase {
	return {
		id: `mapping.${mappingId}`,
		canBeRunAutomatically: true,
		validate: () => {
			let studio = StudioInstallations.findOne()
			if (!studio) return 'Studio not found'

			let dbMapping = studio.mappings[mappingId]
			if (dbMapping) return `Mapping ${mappingId} exists, but should be removed`

			return false
		},
		migrate: () => {
			let studio = StudioInstallations.findOne()
			if (!studio) return 'Studio not found'

			let dbMapping = studio.mappings[mappingId]

			if (dbMapping) { // only remove if the mapping does exist
				let m = {}
				m['mappings.' + mappingId] = 1
				logger.info(`Migration: Removing Studio mapping "${mappingId}" from ${studio._id}`)
				StudioInstallations.update(studio._id, {$unset: m})
			}
		}
	}
}
function ensureDeviceVersion (id, deviceType: PeripheralDeviceAPI.DeviceType, libraryName: string, versionStr: string ): MigrationStepBase {
	return {
		id: id,
		canBeRunAutomatically: true,
		validate: () => {
			let devices = PeripheralDevices.find({type: deviceType}).fetch()

			for (let i in devices) {
				let device = devices[i]
				if (!device.expectedVersions) device.expectedVersions = {}

				let expectedVersion = device.expectedVersions[libraryName]

				if (expectedVersion) {
					try {
						if (compareVersions(parseVersion(expectedVersion), parseVersion(versionStr)) < 0) {
							return `Expected version ${libraryName}: ${expectedVersion} should be at least ${versionStr}`
						}
					} catch (e) {
						return 'Error: ' + e.toString()
					}
				} else return `Expected version ${libraryName}: not set`
			}
			return false
		},
		migrate: () => {
			let devices = PeripheralDevices.find({type: deviceType}).fetch()

			_.each(devices, (device) => {
				if (!device.expectedVersions) device.expectedVersions = {}

				let version = parseVersion(versionStr)
				let expectedVersion = device.expectedVersions[libraryName]
				if (!expectedVersion || compareVersions(parseVersion(expectedVersion), version) < 0) {
					let m = {}
					m['expectedVersions.' + libraryName] = version.toString()
					logger.info(`Migration: Updating expectedVersion ${libraryName} of device ${device._id} from "${expectedVersion}" to "${version.toString()}"`)
					PeripheralDevices.update(device._id, {$set: m})
				}
			})
		}
	}
}

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
				defaultShowStyle: 'show0',
				outputLayers: [
					{
						_id: 'studio0-pgm0',
						_rank: 0,
						name: 'PGM',
						isPGM: true,
					},
					{
						_id: 'studio0-monitor0',
						_rank: 1,
						name: 'Skjerm',
						isPGM: false,
					}
				],
				sourceLayers: [
					{
						_id: 'studio0-lower-third0',
						_rank: 10,
						name: 'Super',
						type: RunningOrderAPI.SourceLayerType.LOWER_THIRD,
						unlimited: true,
						onPGMClean: false
					},
					{
						_id: 'studio0-split0',
						_rank: 15,
						name: 'Split',
						type: RunningOrderAPI.SourceLayerType.SPLITS,
						unlimited: false,
						onPGMClean: true,
					},
					{
						_id: 'studio0-graphics0',
						_rank: 20,
						name: 'GFX',
						type: RunningOrderAPI.SourceLayerType.GRAPHICS,
						unlimited: true,
						onPGMClean: false
					},
					{
						_id: 'studio0-live-speak0',
						_rank: 50,
						name: 'STK',
						type: RunningOrderAPI.SourceLayerType.LIVE_SPEAK,
						unlimited: true,
						onPGMClean: false
					},
					{
						_id: 'studio0-remote0',
						_rank: 60,
						name: 'RM1',
						type: RunningOrderAPI.SourceLayerType.REMOTE,
						unlimited: false,
						onPGMClean: true,
						isRemoteInput: true
					},
					{
						_id: 'studio0-vt0',
						_rank: 80,
						name: 'VB',
						type: RunningOrderAPI.SourceLayerType.VT,
						unlimited: true,
						onPGMClean: true,
					},
					{
						_id: 'studio0-mic0',
						_rank: 90,
						name: 'Mic',
						type: RunningOrderAPI.SourceLayerType.MIC,
						unlimited: false,
						onPGMClean: true,
					},
					{
						_id: 'studio0-camera0',
						_rank: 100,
						name: 'Kam',
						type: RunningOrderAPI.SourceLayerType.CAMERA,
						unlimited: false,
						onPGMClean: true,
					},
				],
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
	ensureCollectionProperty('StudioInstallations', {}, 'defaultShowStyle', null, 'text', 'Studio $id: Default ShowStyle',
		'Enter the Default show style id for this Studio'),
	ensureCollectionProperty('StudioInstallations', {}, 'outputLayers', []),
	ensureCollectionProperty('StudioInstallations', {}, 'sourceLayers', []),
	ensureCollectionProperty('StudioInstallations', {}, 'mappings', {}),
	ensureCollectionProperty('StudioInstallations', {}, 'config', []),

	{
		id: 'showStyle exists',
		canBeRunAutomatically: true,
		validate: () => {
			if (!ShowStyles.findOne()) return 'No ShowStyle found'
			return false
		},
		migrate: () => {
			// create default ShowStyle:
			logger.info(`Migration: Add default showStyle`)
			ShowStyles.insert({
				_id: 'show0',
				name: 'Default showstyle',
				templateMappings: {},
				baselineTemplate: '',
				messageTemplate: '',
				routerBlueprint: '',
				postProcessBlueprint: ''
			})
		}
	},
	ensureCollectionProperty('ShowStyles', {}, 'name', null, 'text', 'ShowStyle $id: Name', 'Enter the Name of the ShowStyles "$id"'),
	ensureCollectionProperty('ShowStyles', {}, 'templateMappings', []),
	// ensureCollectionProperty('ShowStyles', {}, 'baselineTemplate', ''),
	// ensureCollectionProperty('ShowStyles', {}, 'messageTemplate', ''),
	// ensureCollectionProperty('ShowStyles', {}, 'routerBlueprint', ''),
	// ensureCollectionProperty('ShowStyles', {}, 'postProcessBlueprint', ''),

	// Studio configs:
	ensureStudioConfig('media_previews_url', null, 'text', 'Studio $id config: media_previews_url',
		'Enter the url to the Media-previews endpoint (exposed by the CasparCG-Launcher), example: "http://192.168.0.1:8000/"', 'http://IP-ADDRESS:8000/'),
	ensureStudioConfig('sofie_url', null, 'text', 'Studio $id config: sofie_url',
		'Enter the url to this Sofie-application (it\'s the url in your browser), example: "http://sofie01"', 'http://URL-TO-SOFIE'),

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
	ensureSourceLayer({
		_id: 'studio0_hyperdeck0',
		_rank: 0,
		name: 'Hyperdeck',
		type: RunningOrderAPI.SourceLayerType.UNKNOWN,
		onPGMClean: true,
		activateKeyboardHotkeys: '',
		assignHotkeysToGlobalAdlibs: false,
		unlimited: false,
		isHidden: true
	}),
	ensureSourceLayer({
		_id: 'studio0_ptz',
		_rank: 0,
		name: 'Robotics',
		type: RunningOrderAPI.SourceLayerType.CAMERA_MOVEMENT,
		onPGMClean: true,
		activateKeyboardHotkeys: '',
		assignHotkeysToGlobalAdlibs: false,
		unlimited: true
	}),
	ensureMapping('hyperdeck0', literal<MappingHyperdeck>({
		device: PlayoutDeviceType.HYPERDECK,
		deviceId: 'hyperdeck0',
		mappingType: MappingHyperdeckType.TRANSPORT,
		lookahead: LookaheadMode.NONE,
	})),
	ensureMapping('ptz0_preset', literal<MappingPanasonicPtz>({
		device: PlayoutDeviceType.PANASONIC_PTZ,
		deviceId: 'ptz0',
		mappingType: MappingPanasonicPtzType.PRESET,
		lookahead: LookaheadMode.WHEN_CLEAR,
	})),
	ensureMapping('ptz0_speed', literal<MappingPanasonicPtz>({
		device: PlayoutDeviceType.PANASONIC_PTZ,
		deviceId: 'ptz0',
		mappingType: MappingPanasonicPtzType.PRESET_SPEED,
		lookahead: LookaheadMode.NONE,
	})),
	ensureStudioConfig('sources_kam_ptz', '1:ptz0'),
	ensureDeviceVersion('ensureVersion.mosDevice', PeripheralDeviceAPI.DeviceType.MOSDEVICE, '_process', '0.1.1')
])

//// 0.17.0: Release 3
addMigrationSteps( '0.17.0', [
	removeMapping('nora_permanent_klokke'),
	removeMapping('nora_permanent_logo'),
	ensureMapping('nora_primary_klokke', literal<Mapping>({
		device: PlayoutDeviceType.HTTPSEND,
		deviceId: 'http0',
		lookahead: LookaheadMode.NONE,
	})),
	ensureMapping('nora_primary_logo', literal<Mapping>({
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
		type: RunningOrderAPI.SourceLayerType.LIGHTS,
		onPGMClean: false,
		activateKeyboardHotkeys: '',
		assignHotkeysToGlobalAdlibs: false,
		unlimited: false,
		isHidden: true // or should it be?
	}),
	ensureMapping('pharos_lights', literal<Mapping>({
		device: PlayoutDeviceType.PHAROS,
		deviceId: 'pharos0',
		lookahead: LookaheadMode.NONE,
	})),
	ensureMapping('lights_host', literal<Mapping>({
		device: PlayoutDeviceType.ABSTRACT,
		deviceId: 'abstract0',
		lookahead: LookaheadMode.NONE,
	})),
	ensureMapping('lights_guest', literal<Mapping>({
		device: PlayoutDeviceType.ABSTRACT,
		deviceId: 'abstract0',
		lookahead: LookaheadMode.NONE,
	})),
	ensureMapping('lights_studio', literal<Mapping>({
		device: PlayoutDeviceType.ABSTRACT,
		deviceId: 'abstract0',
		lookahead: LookaheadMode.NONE,
	})),
	ensureDeviceVersion('ensureVersion.playoutDevice', PeripheralDeviceAPI.DeviceType.PLAYOUT, '_process', '0.13.0')
])
/*

Epic for tracking whats going to be released in Release3.

R2 rollbacks:
Core:  0.15.0
Mos-gateway: 0.4.0
Playout-gateway:  0.11.1
Blueprintw: #release2

Testing:
Core: r3rc3 (0.16.0), r3rc10
Mos-gateway: 0.4.2
Playout-gateway: 0.11.10
Blues: #r3fc1

CasparCG: https://github.com/nrkno/tv-automation-casparcg-server/releases/tag/v2.1.1_NRK
Launcher: https://github.com/nrkno/tv-automation-casparcg-launcher/releases/tag/v0.3.0
Scanner: https://drive.google.com/open?id=18Ud2qriJzH9ygMfizK6u9qagpWf--cfJ

Core settings:
* slack_evaluation: https://hooks.slack.com/services/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

Database updates:

Device (correct for xpro):
'settings.devices.hyperdeck0': {
    type: PlayoutDeviceType.HYPERDECK,
    options: {
        host: '160.67.87.53',
        port: 9993
    }
},
'settings.devices.ptz0': {
type: PlayoutDeviceType.PANASONIC_PTZ,
options: {
host:'160.67.87.54'
}
}

update http0 to have a make ready command (make sure to update the url):
{
    "id" : "abcde",
    "type" : "put",
    "url" : "http://nora.core.mesos.nrk.no/api/v1/renders/julian?apiKey=sofie-dev-eh47fh",
    "params" : {
        "template" : {
            "event" : "takeout"
        }
    }
}

SourceLayer:
{
    _id: 'studio0_hyperdeck0',
    _rank: 0,
    name: 'Hyperdeck',
    type: RundownAPI.SourceLayerType.UNKNOWN,
    onPGMClean: true,
    activateKeyboardHotkeys: '',
    assignHotkeysToGlobalAdlibs: false,
    unlimited: false,
    isHidden: true
},
{
    _id: 'studio0_ptz',
    _rank: 0,
    name: 'Robotics',
    type: RundownAPI.SourceLayerType.CAMERA_MOVEMENT,
    onPGMClean: true,
    activateKeyboardHotkeys: '',
    assignHotkeysToGlobalAdlibs: false,
    unlimited: true
},

Layer mapping:
'hyperdeck0': literal<MappingHyperdeck>({
    device: PlayoutDeviceType.HYPERDECK,
    deviceId: 'hyperdeck0',
    mappingType: MappingHyperdeckType.TRANSPORT,
    lookahead: LookaheadMode.NONE,
})
'ptz0_preset': literal<MappingPanasonicPtz>({
    device: PlayoutDeviceType.PANASONIC_PTZ,
    deviceId: 'ptz0',
    mappingType: MappingPanasonicPtzType.PRESET,
    lookahead: LookaheadMode.WHEN_CLEAR,
})
'ptz0_speed': literal<MappingPanasonicPtz>({
    device: PlayoutDeviceType.PANASONIC_PTZ,
    deviceId: 'ptz0',
    mappingType: MappingPanasonicPtzType.PRESET_SPEED,
    lookahead: LookaheadMode.NONE,
})

Custom Configuration:
sources_kam_ptz: 1:ptz0

(the custom config needs the layer mapping's prefixes to match the device name, so:

1:ptz0 for ptz0_preset, ptz0_speed, 2:ptz1 for ptz1_preset and ptz1_speed, etc.
)

*/
