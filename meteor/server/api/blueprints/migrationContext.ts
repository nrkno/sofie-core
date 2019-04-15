import * as _ from 'underscore'
import { OmitId, trimIfString, getHash } from '../../../lib/lib'
import { Studios, Studio } from '../../../lib/collections/Studios'
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
		let m: any = {}
		m['mappings.' + mappingId] = mapping
		Studios.update(this.studio._id, {$set: m})
		this.studio.mappings[mappingId] = m['mappings.' + mappingId] // Update local
		return mappingId
	}
	updateMapping (mappingId: string, mapping: Partial<BlueprintMapping>): void {
		check(mappingId, String)
		let m: any = {}
		m['mappings.' + mappingId] = _.extend(this.studio.mappings[mappingId], mapping)
		Studios.update(this.studio._id, {$set: m})
		this.studio.mappings[mappingId] = m['mappings.' + mappingId] // Update local
	}
	removeMapping (mappingId: string): void {
		check(mappingId, String)
		let m: any = {}
		m['mappings.' + mappingId] = 1
		Studios.update(this.studio._id, {$unset: m})
		delete this.studio.mappings[mappingId] // Update local
	}
	getConfig (configId: string): ConfigItemValue | undefined {
		check(configId, String)
		let configItem = _.find(this.studio.config, c => c._id === configId)
		if (configItem) return trimIfString(configItem.value)
	}
	setConfig (configId: string, value: ConfigItemValue): void {
		check(configId, String)

		value = trimIfString(value)

		let configItem = _.find(this.studio.config, c => c._id === configId)
		if (configItem) {
			Studios.update({
				_id: this.studio._id,
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
		return (parentDevice.settings as PlayoutDeviceSettings).devices[deviceId] as PlayoutDeviceSettingsDevice
	}
	insertDevice (deviceId: string, device: PlayoutDeviceSettingsDevice): string | null {
		check(deviceId, String)

		const parentDevice = PeripheralDevices.findOne({
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
			studioId: this.studio._id
		}, {
			sort: {
				created: 1
			}
		})
		if (!parentDevice) return null

		let m: any = {}
		m[`settings.devices.${deviceId}`] = device

		PeripheralDevices.update(parentDevice._id, {
			$set: m
		})

		return ''
	}
	updateDevice (deviceId: string, device: Partial<PlayoutDeviceSettingsDevice>): void {
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
		if (!parentDevice || !parentDevice.settings) return

		let m: any = {}
		m[`settings.devices.${deviceId}`] = _.extend((parentDevice.settings as PlayoutDeviceSettings).devices[deviceId], device)
		PeripheralDevices.update(selector, {
			$set: m
		})
	}
	removeDevice (deviceId: string): void {
		check(deviceId, String)

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
		return ShowStyleVariants.findOne({
			showStyleBaseId: this.showStyleBase._id,
			_id: this.getVariantId(variantId)
		})
	}
	insertVariant (variantId: string, variant: OmitId<ShowStyleVariantPart>): string {
		return ShowStyleVariants.insert(_.extend({}, variant, {
			_id: this.getVariantId(variantId),
			showStyleBaseId: this.showStyleBase._id
		}))
	}
	updateVariant (variantId: string, variant: Partial<ShowStyleVariantPart>): void {
		check(variantId, String)
		ShowStyleVariants.update({
			_id: this.getVariantId(variantId),
			showStyleBaseId: this.showStyleBase._id,
		}, {$set: variant})
	}
	removeVariant (variantId: string): void {
		check(variantId, String)
		ShowStyleVariants.remove({
			_id: this.getVariantId(variantId),
			showStyleBaseId: this.showStyleBase._id,
		})
	}
	getSourceLayer (sourceLayerId: string): ISourceLayer | undefined {
		check(sourceLayerId, String)
		return _.find(this.showStyleBase.sourceLayers, part => part._id === sourceLayerId)
	}
	insertSourceLayer (sourceLayerId: string, layer: OmitId<ISourceLayer>): string {
		if (sourceLayerId) {
			let oldLayer = _.find(this.showStyleBase.sourceLayers, part => part._id === sourceLayerId)
			if (oldLayer) throw new Meteor.Error(500, `Can't insert SourceLayer, _id "${sourceLayerId}" already exists!`)
		}

		let part: ISourceLayer = _.extend(layer, {
			_id: sourceLayerId
		})
		ShowStyleBases.update({
			_id: this.showStyleBase._id,
		}, {$push: {
			sourceLayers: part

		}})
		if (!this.showStyleBase.sourceLayers) this.showStyleBase.sourceLayers = []
		this.showStyleBase.sourceLayers.push(part) // Update local
		return part._id
	}
	updateSourceLayer (sourceLayerId: string, layer: Partial<ISourceLayer>): void {
		check(sourceLayerId, String)
		let part = _.find(this.showStyleBase.sourceLayers, part => part._id === sourceLayerId) as ISourceLayer
		if (!part) throw new Meteor.Error(404, `SourceLayer "${sourceLayerId}" not found`)

		_.each(layer, (value, key: keyof ISourceLayer) => {
			part[key] = value // Update local object
		})
		ShowStyleBases.update({
			_id: this.showStyleBase._id,
			'sourceLayers._id': sourceLayerId
		}, {$set: {
			'sourceLayers.$' : part

		}})

	}
	removeSourceLayer (sourceLayerId: string): void {
		check(sourceLayerId, String)

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
		return _.find(this.showStyleBase.outputLayers, part => part._id === outputLayerId)
	}
	insertOutputLayer (outputLayerId: string, layer: OmitId<IOutputLayer>): string {
		if (outputLayerId) {
			let oldLayer = _.find(this.showStyleBase.outputLayers, part => part._id === outputLayerId)
			if (oldLayer) throw new Meteor.Error(500, `Can't insert OutputLayer, _id "${outputLayerId}" already exists!`)
		}

		let part: IOutputLayer = _.extend(layer, {
			_id: outputLayerId
		})
		ShowStyleBases.update({
			_id: this.showStyleBase._id,
		}, {$push: {
			outputLayers: part

		}})
		if (!this.showStyleBase.outputLayers) this.showStyleBase.outputLayers = []
		this.showStyleBase.outputLayers.push(part) // Update local
		return part._id
	}
	updateOutputLayer (outputLayerId: string, layer: Partial<IOutputLayer>): void {
		check(outputLayerId, String)
		let part: IOutputLayer = _.find(this.showStyleBase.outputLayers, part => part._id === outputLayerId) as IOutputLayer
		if (!part) throw new Meteor.Error(404, `OutputLayer "${outputLayerId}" not found`)

		_.each(layer, (value, key: keyof IOutputLayer) => {
			// @ts-ignore Type 'undefined' is not assignable to type 'ConfigItemValue'
			part[key] = value // Update local
		})
		ShowStyleBases.update({
			_id: this.showStyleBase._id,
			'outputLayers._id': outputLayerId
		}, {$set: {
			'outputLayers.$' : part

		}})
	}
	removeOutputLayer (outputLayerId: string): void {
		check(outputLayerId, String)
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
		if (_.isUndefined(value)) throw new Meteor.Error(400, `setBaseConfig "${configId}": value is undefined`)

		value = trimIfString(value)

		let configItem = _.find(this.showStyleBase.config, c => c._id === configId)
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
	getVariantConfig (variantId: string, configId: string): ConfigItemValue | undefined {
		check(variantId, String)
		check(configId, String)

		let variant = ShowStyleVariants.findOne({
			_id: this.getVariantId(variantId),
			showStyleBaseId: this.showStyleBase._id
		}) as ShowStyleVariant
		if (!variant) throw new Meteor.Error(404, `ShowStyleVariant "${variantId}" not found`)

		let configItem = _.find(variant.config, c => c._id === configId)
		if (configItem) return trimIfString(configItem.value)
	}
	setVariantConfig (variantId: string, configId: string, value: ConfigItemValue): void {
		check(variantId, String)
		check(configId, String)

		value = trimIfString(value)

		if (_.isUndefined(value)) throw new Meteor.Error(400, `setVariantConfig "${variantId}", "${configId}": value is undefined`)

		// console.log('setVariantConfig', variantId, configId, value)

		let variant = ShowStyleVariants.findOne({
			_id: this.getVariantId(variantId),
			showStyleBaseId: this.showStyleBase._id
		}) as ShowStyleVariant
		if (!variant) throw new Meteor.Error(404, `ShowStyleVariant "${variantId}" not found`)

		let configItem = _.find(variant.config, c => c._id === configId)
		if (configItem) {
			ShowStyleVariants.update({
				_id: variant._id,
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

		let variant = ShowStyleVariants.findOne({
			_id: this.getVariantId(variantId),
			showStyleBaseId: this.showStyleBase._id
		}) as ShowStyleVariant
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

	getRuntimeArgument (argumentId: string): IBlueprintRuntimeArgumentsItem | undefined {
		check(argumentId, String)
		return _.find(this.showStyleBase.runtimeArguments || [], ra => ra._id === argumentId)
	}
	insertRuntimeArgument (argumentId: string, argument: IBlueprintRuntimeArgumentsItem) {
		if (argumentId && this.showStyleBase.runtimeArguments) {
			let oldLayer = _.find(this.showStyleBase.runtimeArguments, ra => ra._id === argumentId)
			if (oldLayer) throw new Meteor.Error(500, `Can't insert RuntimeArgument, _id "${argumentId}" already exists!`)
		}

		let ra: IBlueprintRuntimeArgumentsItem = _.extend(argument, {
			_id: argumentId
		})
		ShowStyleBases.update({
			_id: this.showStyleBase._id,
		}, {$push: {
			runtimeArguments: ra
		}})
		if (!this.showStyleBase.outputLayers) this.showStyleBase.outputLayers = []
		this.showStyleBase.runtimeArguments.push(ra) // Update local
	}
	updateRuntimeArgument (argumentId: string, argument: Partial<OmitId<IBlueprintRuntimeArgumentsItem>>) {
		check(argumentId, String)
		let ra = _.find(this.showStyleBase.runtimeArguments, ra => ra._id === argumentId) as IBlueprintRuntimeArgumentsItem
		if (!ra) throw new Meteor.Error(404, `RuntimeArgument "${argumentId}" not found`)

		_.each(argument, (value, key) => {
			ra[key] = value // Update local
		})
		ShowStyleBases.update({
			_id: this.showStyleBase._id,
			'runtimeArguments._id': argumentId
		}, {$set: {
			'runtimeArguments.$' : ra
		}})
	}
	removeRuntimeArgument (argumentId: string) {
		check(argumentId, String)
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
