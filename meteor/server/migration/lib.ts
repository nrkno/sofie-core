import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import { MigrationStepInput, MigrationStepInputFilteredResult } from '../../lib/api/migration'
import { MigrationStepBase } from './databaseMigration'
import { Collections, objectPathGet, literal } from '../../lib/lib'
import { Meteor } from 'meteor/meteor'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { Mapping } from 'timeline-state-resolver-types'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { compareVersions, parseVersion } from '../../lib/collections/CoreSystem'
import { logger } from '../logging'
import { StudioInstallations, StudioInstallation } from '../../lib/collections/StudioInstallations'
import { ISourceLayer, ShowStyleBases, IOutputLayer } from '../../lib/collections/ShowStyleBases'

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
export function ensureCollectionProperty<T = any> (
	collectionName: string,
	selector: Mongo.Selector<T>,
	property: string,
	value: any | null, // null if manual
	inputType?: 'text' | 'multiline' | 'int' | 'checkbox' | 'dropdown' | 'switch', // EditAttribute types
	label?: string,
	description?: string,
	defaultValue?: any,
	dependOnResultFrom?: string
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
				let objValue = objectPathGet(obj, property)
				if (!objValue && objValue !== value) {
					propertyMissing = `${property} is missing on ${obj._id}`
				}
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
		},
		dependOnResultFrom: dependOnResultFrom
	}
}
export function ensureStudioConfig (
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

export function ensureSourceLayer (sourceLayer: ISourceLayer): MigrationStepBase {
	return {
		id: `sourceLayer.${sourceLayer._id}`,
		canBeRunAutomatically: true,
		validate: () => {
			let validate: false | string = false
			ShowStyleBases.find().forEach((showStyleBase) => {
				let sl = _.find(showStyleBase.sourceLayers, (sl) => {
					return sl._id === sourceLayer._id
				})
				if (!sl) validate = `SourceLayer ${sourceLayer._id} missing in ${showStyleBase.name} (${showStyleBase._id})`
			})
			return validate
		},
		migrate: () => {
			ShowStyleBases.find().forEach((showStyleBase) => {
				let sl = _.find(showStyleBase.sourceLayers, (sl) => {
					return sl._id === sourceLayer._id
				})
				if (!sl) {
					logger.info(`Migration: Adding sourceLayer "${sourceLayer._id}" to ${showStyleBase._id}`)
					ShowStyleBases.update(showStyleBase._id, {$push: {
						'sourceLayers': sourceLayer
					}})
				}
			})
		}
	}
}
export function ensureOutputLayer (outputLayer: IOutputLayer): MigrationStepBase {
	return {
		id: `outputLayer.${outputLayer._id}`,
		canBeRunAutomatically: true,
		validate: () => {
			let validate: false | string = false
			ShowStyleBases.find().forEach((showStyleBase) => {
				let sl = _.find(showStyleBase.outputLayers, (sl) => {
					return sl._id === outputLayer._id
				})
				if (!sl) validate = `OutputLayer ${outputLayer._id} missing in ${showStyleBase.name} (${showStyleBase._id})`
			})
			return validate
		},
		migrate: () => {
			ShowStyleBases.find().forEach((showStyleBase) => {
				let sl = _.find(showStyleBase.outputLayers, (sl) => {
					return sl._id === outputLayer._id
				})
				if (!sl) {
					logger.info(`Migration: Adding outputLayer "${outputLayer._id}" to ${showStyleBase._id}`)
					ShowStyleBases.update(showStyleBase._id, {$push: {
						'outputLayers': outputLayer
					}})
				}
			})
		}
	}
}
export function ensureMapping (mappingId: string, mapping: Mapping): MigrationStepBase {
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
export function removeMapping (mappingId: string): MigrationStepBase {
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
export function ensureDeviceVersion (id, deviceType: PeripheralDeviceAPI.DeviceType, libraryName: string, versionStr: string ): MigrationStepBase {
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
		},
		overrideSteps: [id]
	}
}
