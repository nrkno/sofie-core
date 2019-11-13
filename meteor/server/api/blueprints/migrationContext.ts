import * as _ from 'underscore'
import { OmitId, trimIfString, getHash } from '../../../lib/lib'
import { Studios, Studio, DBStudio } from '../../../lib/collections/Studios'
import { ShowStyleBase, ShowStyleBases } from '../../../lib/collections/ShowStyleBases'
import { Meteor } from 'meteor/meteor'
import {
	ConfigItemValue,
	MigrationContextStudio as IMigrationContextStudio,
	MigrationContextShowStyle as IMigrationContextShowStyle,
	BlueprintMapping,
	IConfigItem,
	IOutputLayer,
	ISourceLayer,
	ShowStyleVariantPart,
	IBlueprintShowStyleVariant,
	IBlueprintRuntimeArgumentsItem,
} from 'tv-automation-sofie-blueprints-integration'

import { ShowStyleVariants, ShowStyleVariant } from '../../../lib/collections/ShowStyleVariants'
import { check } from 'meteor/check'
import { DeviceOptions as PlayoutDeviceSettingsDevice } from 'timeline-state-resolver-types'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { PeripheralDevices, PeripheralDevice } from '../../../lib/collections/PeripheralDevices'
import { PlayoutDeviceSettings } from '../../../lib/collections/PeripheralDeviceSettings/playoutDevice'
import { Mongo } from 'meteor/mongo'

export class MigrationContextStudio implements IMigrationContextStudio {
	private studio: Studio

	constructor (studio: Studio) {
		this.studio = studio
	}

	getMapping (mappingId: string): BlueprintMapping | undefined {
		check(mappingId, String)
		let mapping = this.studio.mappings[mappingId]
		if (mapping) return _.clone(mapping)
	}
	insertMapping (mappingId: string, mapping: OmitId<BlueprintMapping>): string {
		check(mappingId, String)
		if (this.studio.mappings[mappingId]) {
			throw new Meteor.Error(404, `Mapping "${mappingId}" cannot be inserted as it already exists`)
		}
		if (!mappingId) {
			throw new Meteor.Error(500, `Mapping id "${mappingId}" is invalid`)
		}

		let m: any = {}
		m['mappings.' + mappingId] = mapping
		Studios.update(this.studio._id, { $set: m })
		this.studio.mappings[mappingId] = m['mappings.' + mappingId] // Update local
		return mappingId
	}
	updateMapping (mappingId: string, mapping: Partial<BlueprintMapping>): void {
		check(mappingId, String)
		if (!this.studio.mappings[mappingId]) {
			throw new Meteor.Error(404, `Mapping "${mappingId}" cannot be updated as it does not exist`)
		}

		if (mappingId) {
			let m: any = {}
			m['mappings.' + mappingId] = _.extend(this.studio.mappings[mappingId], mapping)
			Studios.update(this.studio._id, { $set: m })
			this.studio.mappings[mappingId] = m['mappings.' + mappingId] // Update local
		}
	}
	removeMapping (mappingId: string): void {
		check(mappingId, String)
		if (mappingId) {
			let m: any = {}
			m['mappings.' + mappingId] = 1
			Studios.update(this.studio._id, { $unset: m })
			delete this.studio.mappings[mappingId] // Update local
		}
	}

	getConfig (configId: string): ConfigItemValue | undefined {
		check(configId, String)
		let configItem = _.find(this.studio.config, c => c._id === configId)
		if (configItem) return trimIfString(configItem.value)
	}
	setConfig (configId: string, value: ConfigItemValue): void {
		check(configId, String)
		if (!configId) {
			throw new Meteor.Error(500, `Config id "${configId}" is invalid`)
		}

		value = trimIfString(value)

		const configItem = _.find(this.studio.config, c => c._id === configId)
		if (configItem) {
			let modifier: Mongo.Modifier<DBStudio> = {}
			if (value === undefined) {
				modifier = {$unset: {
					'config.$.value' : 1
				}}
				delete configItem.value // Update local
			} else {
				modifier = {$set: {
					'config.$.value' : value
				}}
				configItem.value = value // Update local
			}
			Studios.update({
				_id: this.studio._id,
				'config._id': configId
			}, modifier)
		} else {
			let config: IConfigItem = {
				_id: configId,
				value: value
			}
			Studios.update({
				_id: this.studio._id,
			}, {$push: {
				config : config
			}})
			if (!this.studio.config) this.studio.config = []
			this.studio.config.push(config) // Update local
		}
	}
	removeConfig (configId: string): void {
		check(configId, String)

		if (configId) {
			Studios.update({
				_id: this.studio._id,
			}, {$pull: {
				'config': {
					_id: configId
				}
			}})
			// Update local:
			this.studio.config = _.reject(this.studio.config, c => c._id === configId)
		}
	}

	getDevice (deviceId: string): PlayoutDeviceSettingsDevice | undefined {
		check(deviceId, String)

		const selector: Mongo.Selector<PeripheralDevice> = {
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
			studioId: this.studio._id
		}
		selector[`settings.devices.${deviceId}`] = { $exists: 1 }

		const parentDevice = PeripheralDevices.findOne(selector, {
			sort: {
				created: 1
			}
		})

		if (!parentDevice || !parentDevice.settings) return undefined
		return (parentDevice.settings as PlayoutDeviceSettings).devices[deviceId]
	}
	insertDevice (deviceId: string, device: PlayoutDeviceSettingsDevice): string {
		check(deviceId, String)

		if (!deviceId) {
			throw new Meteor.Error(500, `Device id "${deviceId}" is invalid`)
		}

		const parentDevice = PeripheralDevices.findOne({
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
			studioId: this.studio._id
		}, {
			sort: {
				created: 1
			}
		})
		if (!parentDevice) {
			throw new Meteor.Error(404, `No parent device for new device id "${deviceId}"`)
		}

		const settings = parentDevice.settings as PlayoutDeviceSettings | undefined
		if (settings && settings.devices[deviceId]) {
			throw new Meteor.Error(404, `Device "${deviceId}" cannot be inserted as it already exists`)
		}

		let m: any = {}
		m[`settings.devices.${deviceId}`] = device

		PeripheralDevices.update(parentDevice._id, {
			$set: m
		})

		return deviceId
	}
	updateDevice (deviceId: string, device: Partial<PlayoutDeviceSettingsDevice>): void {
		check(deviceId, String)

		if (!deviceId) {
			throw new Meteor.Error(500, `Device id "${deviceId}" is invalid`)
		}

		const selector: Mongo.Selector<PeripheralDevice> = {
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
			studioId: this.studio._id
		}
		selector[`settings.devices.${deviceId}`] = { $exists: 1 }

		const parentDevice = PeripheralDevices.findOne(selector, {
			sort: {
				created: 1
			}
		})
		if (!parentDevice || !parentDevice.settings) {
			throw new Meteor.Error(404, `Device "${deviceId}" cannot be updated as it does not exist`)
		}

		let m: any = {}
		m[`settings.devices.${deviceId}`] = _.extend((parentDevice.settings as PlayoutDeviceSettings).devices[deviceId], device)
		PeripheralDevices.update(selector, {
			$set: m
		})
	}
	removeDevice (deviceId: string): void {
		check(deviceId, String)

		if (!deviceId) {
			throw new Meteor.Error(500, `Device id "${deviceId}" is invalid`)
		}

		let m: any = {}
		m[`settings.devices.${deviceId}`] = 1
		PeripheralDevices.update({
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
			studioId: this.studio._id
		}, {
			$unset: m
		})
	}
}

export class MigrationContextShowStyle implements IMigrationContextShowStyle {
	private showStyleBase: ShowStyleBase

	constructor (showStyleBase: ShowStyleBase) {
		this.showStyleBase = showStyleBase
	}

	getAllVariants (): IBlueprintShowStyleVariant[] {
		return ShowStyleVariants.find({
			showStyleBaseId: this.showStyleBase._id
		}).fetch()
	}
	getVariantId (variantId: string): string {
		return getHash(this.showStyleBase._id + '_' + variantId)
	}
	getVariant (variantId: string): IBlueprintShowStyleVariant | undefined {
		check(variantId, String)
		if (!variantId) {
			throw new Meteor.Error(500, `Variant id "${variantId}" is invalid`)
		}

		return ShowStyleVariants.findOne({
			showStyleBaseId: this.showStyleBase._id,
			_id: this.getVariantId(variantId)
		})
	}
	insertVariant (variantId: string, variant: OmitId<ShowStyleVariantPart>): string {
		check(variantId, String)
		if (!variantId) {
			throw new Meteor.Error(500, `Variant id "${variantId}" is invalid`)
		}

		return ShowStyleVariants.insert({
			...variant,
			_id: this.getVariantId(variantId),
			showStyleBaseId: this.showStyleBase._id,
			config: [],
			_rundownVersionHash: ''
		})
	}
	updateVariant (variantId: string, variant: Partial<ShowStyleVariantPart>): void {
		check(variantId, String)
		if (!variantId) {
			throw new Meteor.Error(500, `Variant id "${variantId}" is invalid`)
		}

		ShowStyleVariants.update({
			_id: this.getVariantId(variantId),
			showStyleBaseId: this.showStyleBase._id,
		}, { $set: variant })
	}
	removeVariant (variantId: string): void {
		check(variantId, String)
		if (!variantId) {
			throw new Meteor.Error(500, `Variant id "${variantId}" is invalid`)
		}

		ShowStyleVariants.remove({
			_id: this.getVariantId(variantId),
			showStyleBaseId: this.showStyleBase._id,
		})
	}
	getSourceLayer (sourceLayerId: string): ISourceLayer | undefined {
		check(sourceLayerId, String)
		if (!sourceLayerId) {
			throw new Meteor.Error(500, `SourceLayer id "${sourceLayerId}" is invalid`)
		}

		return _.find(this.showStyleBase.sourceLayers, part => part._id === sourceLayerId)
	}
	insertSourceLayer (sourceLayerId: string, layer: OmitId<ISourceLayer>): string {
		check(sourceLayerId, String)
		if (!sourceLayerId) {
			throw new Meteor.Error(500, `SourceLayer id "${sourceLayerId}" is invalid`)
		}

		const oldLayer = _.find(this.showStyleBase.sourceLayers, part => part._id === sourceLayerId)
		if (oldLayer) {
			throw new Meteor.Error(500, `SourceLayer "${sourceLayerId}" already exists`)
		}

		const fullLayer: ISourceLayer = {
			...layer,
			_id: sourceLayerId
		}
		ShowStyleBases.update({
			_id: this.showStyleBase._id,
		}, {$push: {
			sourceLayers: fullLayer

		}})
		if (!this.showStyleBase.sourceLayers) this.showStyleBase.sourceLayers = []
		this.showStyleBase.sourceLayers.push(fullLayer) // Update local
		return fullLayer._id
	}
	updateSourceLayer (sourceLayerId: string, layer: Partial<ISourceLayer>): void {
		check(sourceLayerId, String)
		if (!sourceLayerId) {
			throw new Meteor.Error(500, `SourceLayer id "${sourceLayerId}" is invalid`)
		}

		const localLayerIndex = _.findIndex(this.showStyleBase.sourceLayers, part => part._id === sourceLayerId)
		if (localLayerIndex === -1) {
			throw new Meteor.Error(404, `SourceLayer "${sourceLayerId}" cannot be updated as it does not exist`)
		}

		const fullLayer = {
			...this.showStyleBase.sourceLayers[localLayerIndex],
			...layer
		}
		ShowStyleBases.update({
			_id: this.showStyleBase._id,
			'sourceLayers._id': sourceLayerId
		}, {$set: {
			'sourceLayers.$' : fullLayer

		}})
		this.showStyleBase.sourceLayers[localLayerIndex] = fullLayer // Update local
	}
	removeSourceLayer (sourceLayerId: string): void {
		check(sourceLayerId, String)
		if (!sourceLayerId) {
			throw new Meteor.Error(500, `SourceLayer id "${sourceLayerId}" is invalid`)
		}

		ShowStyleBases.update({
			_id: this.showStyleBase._id,
		}, {$pull: {
			'sourceLayers': {
				_id: sourceLayerId
			}
		}})
		// Update local:
		this.showStyleBase.sourceLayers = _.reject(this.showStyleBase.sourceLayers, c => c._id === sourceLayerId)
	}
	getOutputLayer (outputLayerId: string): IOutputLayer | undefined {
		check(outputLayerId, String)
		if (!outputLayerId) {
			throw new Meteor.Error(500, `OutputLayer id "${outputLayerId}" is invalid`)
		}

		return _.find(this.showStyleBase.outputLayers, part => part._id === outputLayerId)
	}
	insertOutputLayer (outputLayerId: string, layer: OmitId<IOutputLayer>): string {
		check(outputLayerId, String)
		if (!outputLayerId) {
			throw new Meteor.Error(500, `OutputLayer id "${outputLayerId}" is invalid`)
		}

		const oldLayer = _.find(this.showStyleBase.outputLayers, part => part._id === outputLayerId)
		if (oldLayer) {
			throw new Meteor.Error(500, `OutputLayer "${outputLayerId}" already exists`)
		}

		const fullLayer: IOutputLayer = {
			...layer,
			_id: outputLayerId
		}
		ShowStyleBases.update({
			_id: this.showStyleBase._id,
		}, {$push: {
			outputLayers: fullLayer

		}})
		if (!this.showStyleBase.outputLayers) this.showStyleBase.outputLayers = []
		this.showStyleBase.outputLayers.push(fullLayer) // Update local
		return fullLayer._id
	}
	updateOutputLayer (outputLayerId: string, layer: Partial<IOutputLayer>): void {
		check(outputLayerId, String)
		if (!outputLayerId) {
			throw new Meteor.Error(500, `OutputLayer id "${outputLayerId}" is invalid`)
		}

		const localLayerIndex = _.findIndex(this.showStyleBase.outputLayers, part => part._id === outputLayerId)
		if (localLayerIndex === -1) {
			throw new Meteor.Error(404, `OutputLayer "${outputLayerId}" cannot be updated as it does not exist`)
		}

		const fullLayer = {
			...this.showStyleBase.outputLayers[localLayerIndex],
			...layer
		}
		ShowStyleBases.update({
			_id: this.showStyleBase._id,
			'outputLayers._id': outputLayerId
		}, {$set: {
			'outputLayers.$' : fullLayer
		}})
		this.showStyleBase.outputLayers[localLayerIndex] = fullLayer // Update local
	}
	removeOutputLayer (outputLayerId: string): void {
		check(outputLayerId, String)
		if (!outputLayerId) {
			throw new Meteor.Error(500, `OutputLayer id "${outputLayerId}" is invalid`)
		}

		ShowStyleBases.update({
			_id: this.showStyleBase._id,
		}, {$pull: {
			'outputLayers': {
				_id: outputLayerId
			}
		}})
		// Update local:
		this.showStyleBase.outputLayers = _.reject(this.showStyleBase.outputLayers, c => c._id === outputLayerId)
	}
	getBaseConfig (configId: string): ConfigItemValue | undefined {
		check(configId, String)
		let configItem = _.find(this.showStyleBase.config, c => c._id === configId)
		if (configItem) return trimIfString(configItem.value)
	}
	setBaseConfig (configId: string, value: ConfigItemValue): void {
		check(configId, String)
		if (!configId) {
			throw new Meteor.Error(500, `Config id "${configId}" is invalid`)
		}

		if (_.isUndefined(value)) throw new Meteor.Error(400, `setBaseConfig "${configId}": value is undefined`)

		value = trimIfString(value)

		const configItem = _.find(this.showStyleBase.config, c => c._id === configId)
		if (configItem) {
			ShowStyleBases.update({
				_id: this.showStyleBase._id,
				'config._id': configId
			}, {$set: {
				'config.$.value' : value
			}})
			configItem.value = value // Update local
		} else {
			let config: IConfigItem = {
				_id: configId,
				value: value
			}
			ShowStyleBases.update({
				_id: this.showStyleBase._id,
			}, {$push: {
				config : config
			}})
			if (!this.showStyleBase.config) this.showStyleBase.config = []
			this.showStyleBase.config.push(config) // Update local
		}
	}
	removeBaseConfig (configId: string): void {
		check(configId, String)
		if (configId) {
			ShowStyleBases.update({
				_id: this.showStyleBase._id,
			}, {$pull: {
				'config': {
					_id: configId
				}
			}})
			// Update local:
			this.showStyleBase.config = _.reject(this.showStyleBase.config, c => c._id === configId)
		}
	}
	getVariantConfig (variantId: string, configId: string): ConfigItemValue | undefined {
		check(variantId, String)
		check(configId, String)

		const variant = ShowStyleVariants.findOne({
			_id: this.getVariantId(variantId),
			showStyleBaseId: this.showStyleBase._id
		}) as ShowStyleVariant
		if (!variant) throw new Meteor.Error(404, `ShowStyleVariant "${variantId}" not found`)

		const configItem = _.find(variant.config, c => c._id === configId)
		if (configItem) return trimIfString(configItem.value)
	}
	setVariantConfig (variantId: string, configId: string, value: ConfigItemValue): void {
		check(variantId, String)
		check(configId, String)
		if (!configId) {
			throw new Meteor.Error(500, `Config id "${configId}" is invalid`)
		}

		value = trimIfString(value)

		if (_.isUndefined(value)) throw new Meteor.Error(400, `setVariantConfig "${variantId}", "${configId}": value is undefined`)

		// console.log('setVariantConfig', variantId, configId, value)

		const variant = ShowStyleVariants.findOne({
			_id: this.getVariantId(variantId),
			showStyleBaseId: this.showStyleBase._id
		})
		if (!variant) throw new Meteor.Error(404, `ShowStyleVariant "${variantId}" not found`)

		const configItem = _.find(variant.config, c => c._id === configId)
		if (configItem) {
			ShowStyleVariants.update({
				_id: variant._id,
				'config._id': configId
			}, {$set: {
				'config.$.value' : value
			}})
			configItem.value = value // Update local
		} else {
			const config: IConfigItem = {
				_id: configId,
				value: value
			}
			ShowStyleVariants.update({
				_id: variant._id,
			}, {$push: {
				config : config
			}})
			if (!variant.config) variant.config = []
			variant.config.push(config) // Update local
		}
	}
	removeVariantConfig (variantId: string, configId: string): void {
		check(variantId, String)
		check(configId, String)

		if (configId) {
			const variant = ShowStyleVariants.findOne({
				_id: this.getVariantId(variantId),
				showStyleBaseId: this.showStyleBase._id
			})
			if (!variant) throw new Meteor.Error(404, `ShowStyleVariant "${variantId}" not found`)

			ShowStyleVariants.update({
				_id: variant._id,
			}, {$pull: {
				'config': {
					_id: configId
				}
			}})
			// Update local:
			this.showStyleBase.config = _.reject(this.showStyleBase.config, c => c._id === configId)
		}
	}

	getRuntimeArgument (argumentId: string): IBlueprintRuntimeArgumentsItem | undefined {
		check(argumentId, String)
		if (!argumentId) {
			throw new Meteor.Error(500, `RuntimeArgument id "${argumentId}" is invalid`)
		}

		return _.find(this.showStyleBase.runtimeArguments || [], ra => ra._id === argumentId)
	}
	insertRuntimeArgument (argumentId: string, argument: OmitId<IBlueprintRuntimeArgumentsItem>) {
		check(argumentId, String)
		if (!argumentId) {
			throw new Meteor.Error(500, `RuntimeArgument id "${argumentId}" is invalid`)
		}

		const oldRa = _.find(this.showStyleBase.runtimeArguments || [], ra => ra._id === argumentId)
		if (oldRa) {
			throw new Meteor.Error(500, `RuntimeArgument "${argumentId}" already exists`)
		}

		const fullRa: IBlueprintRuntimeArgumentsItem = {
			...argument,
			_id: argumentId
		}
		ShowStyleBases.update({
			_id: this.showStyleBase._id,
		}, {$push: {
			runtimeArguments: fullRa
		}})
		if (!this.showStyleBase.runtimeArguments) this.showStyleBase.runtimeArguments = []
		this.showStyleBase.runtimeArguments.push(fullRa) // Update local
	}
	updateRuntimeArgument (argumentId: string, argument: Partial<OmitId<IBlueprintRuntimeArgumentsItem>>) {
		check(argumentId, String)
		if (!argumentId) {
			throw new Meteor.Error(500, `RuntimeArgument id "${argumentId}" is invalid`)
		}

		const localRaIndex = _.findIndex(this.showStyleBase.runtimeArguments || [], ra => ra._id === argumentId)
		if (localRaIndex === -1) {
			throw new Meteor.Error(404, `RuntimeArgument "${argumentId}" cannot be updated as it does not exist`)
		}

		const fullRa = {
			...this.showStyleBase.runtimeArguments[localRaIndex],
			...argument
		}
		ShowStyleBases.update({
			_id: this.showStyleBase._id,
			'runtimeArguments._id': argumentId
		}, {$set: {
			'runtimeArguments.$' : fullRa
		}})
		this.showStyleBase.runtimeArguments[localRaIndex] = fullRa // Update local
	}
	removeRuntimeArgument (argumentId: string) {
		check(argumentId, String)
		if (!argumentId) {
			throw new Meteor.Error(500, `RuntimeArgument id "${argumentId}" is invalid`)
		}

		ShowStyleBases.update({
			_id: this.showStyleBase._id,
		}, {$pull: {
			'runtimeArguments': {
				_id: argumentId
			}
		}})
		// Update local:
		this.showStyleBase.runtimeArguments = _.reject(this.showStyleBase.runtimeArguments, c => c._id === argumentId)
	}
}
