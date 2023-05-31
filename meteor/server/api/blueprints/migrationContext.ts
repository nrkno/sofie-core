import * as _ from 'underscore'
import * as objectPath from 'object-path'
import {
	trimIfString,
	getHash,
	unprotectObject,
	protectString,
	unprotectString,
	objectPathGet,
	objectPathSet,
	clone,
	Complete,
	waitForPromise,
} from '../../../lib/lib'
import { Studio, DBStudio, StudioPlayoutDevice } from '../../../lib/collections/Studios'
import { ShowStyleBase, DBShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { Meteor } from 'meteor/meteor'
import {
	ConfigItemValue,
	MigrationContextStudio as IMigrationContextStudio,
	MigrationContextShowStyle as IMigrationContextShowStyle,
	MigrationContextSystem as IMigrationContextSystem,
	BlueprintMapping,
	IOutputLayer,
	ISourceLayer,
	ShowStyleVariantPart,
	IBlueprintShowStyleVariant,
	TSR,
	OmitId,
	IBlueprintTriggeredActions,
} from '@sofie-automation/blueprints-integration'

import { ShowStyleVariant, DBShowStyleVariant } from '../../../lib/collections/ShowStyleVariants'
import { check } from '../../../lib/check'
import { PERIPHERAL_SUBTYPE_PROCESS, PeripheralDeviceType } from '../../../lib/collections/PeripheralDevices'
import { TriggeredActionsObj } from '../../../lib/collections/TriggeredActions'
import { Match } from 'meteor/check'
import { MongoModifier } from '../../../lib/typings/meteor'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ShowStyleBaseId, ShowStyleVariantId, TriggeredActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevices, ShowStyleBases, ShowStyleVariants, Studios, TriggeredActions } from '../../collections'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'

function convertTriggeredActionToBlueprints(triggeredAction: TriggeredActionsObj): IBlueprintTriggeredActions {
	const obj: Complete<IBlueprintTriggeredActions> = {
		_id: unprotectString(triggeredAction._id),
		_rank: triggeredAction._rank,
		name: triggeredAction.name,
		triggers: clone(triggeredAction.triggersWithOverrides.defaults),
		actions: clone(triggeredAction.actionsWithOverrides.defaults),
	}

	return obj
}

class AbstractMigrationContextWithTriggeredActions {
	protected showStyleBaseId: ShowStyleBaseId | null = null
	getTriggeredActionId(triggeredActionId: string): string {
		return getHash((this.showStyleBaseId ?? 'core') + '_' + triggeredActionId)
	}
	private getProtectedTriggeredActionId(triggeredActionId: string): TriggeredActionId {
		return protectString(this.getTriggeredActionId(triggeredActionId))
	}
	getAllTriggeredActions(): IBlueprintTriggeredActions[] {
		return waitForPromise(
			TriggeredActions.findFetchAsync({
				showStyleBaseId: this.showStyleBaseId,
			})
		).map(convertTriggeredActionToBlueprints)
	}
	private getTriggeredActionFromDb(triggeredActionId: string): TriggeredActionsObj | undefined {
		const triggeredAction = waitForPromise(
			TriggeredActions.findOneAsync({
				showStyleBaseId: this.showStyleBaseId,
				_id: this.getProtectedTriggeredActionId(triggeredActionId),
			})
		)
		if (triggeredAction) return triggeredAction

		// Assume we were given the full id
		return waitForPromise(
			TriggeredActions.findOneAsync({
				showStyleBaseId: this.showStyleBaseId,
				_id: protectString(triggeredActionId),
			})
		)
	}
	getTriggeredAction(triggeredActionId: string): IBlueprintTriggeredActions | undefined {
		check(triggeredActionId, String)
		if (!triggeredActionId) {
			throw new Meteor.Error(500, `Triggered actions Id "${triggeredActionId}" is invalid`)
		}

		const obj = this.getTriggeredActionFromDb(triggeredActionId)
		return obj ? convertTriggeredActionToBlueprints(obj) : undefined
	}
	setTriggeredAction(triggeredActions: IBlueprintTriggeredActions) {
		check(triggeredActions, Object)
		check(triggeredActions._id, String)
		check(triggeredActions._rank, Number)
		check(triggeredActions.actions, Object)
		check(triggeredActions.triggers, Object)
		check(triggeredActions.name, Match.OneOf(Match.Optional(Object), Match.Optional(String)))
		if (!triggeredActions) {
			throw new Meteor.Error(500, `Triggered Actions object is invalid`)
		}

		const newObj: Omit<TriggeredActionsObj, '_id' | '_rundownVersionHash' | 'showStyleBaseId'> = {
			// _rundownVersionHash: '',
			// _id: this.getProtectedTriggeredActionId(triggeredActions._id),
			_rank: triggeredActions._rank,
			name: triggeredActions.name,
			triggersWithOverrides: wrapDefaultObject(triggeredActions.triggers),
			actionsWithOverrides: wrapDefaultObject(triggeredActions.actions),
			blueprintUniqueId: triggeredActions._id,
		}

		const currentTriggeredAction = this.getTriggeredActionFromDb(triggeredActions._id)
		if (!currentTriggeredAction) {
			waitForPromise(
				TriggeredActions.insertAsync({
					...newObj,
					showStyleBaseId: this.showStyleBaseId,
					_id: this.getProtectedTriggeredActionId(triggeredActions._id),
				})
			)
		} else {
			waitForPromise(
				TriggeredActions.updateAsync(
					{
						_id: currentTriggeredAction._id,
					},
					{
						$set: newObj,
					}
				)
			)
		}
	}
	removeTriggeredAction(triggeredActionId: string) {
		check(triggeredActionId, String)
		if (!triggeredActionId) {
			throw new Meteor.Error(500, `Triggered actions Id "${triggeredActionId}" is invalid`)
		}

		const currentTriggeredAction = this.getTriggeredActionFromDb(triggeredActionId)
		if (currentTriggeredAction) {
			waitForPromise(
				TriggeredActions.removeAsync({
					_id: currentTriggeredAction._id,
					showStyleBaseId: this.showStyleBaseId,
				})
			)
		}
	}
}

export class MigrationContextSystem
	extends AbstractMigrationContextWithTriggeredActions
	implements IMigrationContextSystem {}

export class MigrationContextStudio implements IMigrationContextStudio {
	private studio: Studio

	constructor(studio: Studio) {
		this.studio = studio
	}

	getMapping(mappingId: string): BlueprintMapping | undefined {
		check(mappingId, String)
		const mapping = this.studio.mappingsWithOverrides.defaults[mappingId]
		if (mapping) {
			return clone({
				...mapping,
				deviceId: unprotectString(mapping.deviceId),
			})
		}
	}
	insertMapping(mappingId: string, mapping: OmitId<BlueprintMapping>): string {
		check(mappingId, String)
		if (this.studio.mappingsWithOverrides.defaults[mappingId]) {
			throw new Meteor.Error(404, `Mapping "${mappingId}" cannot be inserted as it already exists`)
		}
		if (!mappingId) {
			throw new Meteor.Error(500, `Mapping id "${mappingId}" is invalid`)
		}

		const m: any = {}
		m['mappingsWithOverrides.defaults.' + mappingId] = mapping
		waitForPromise(Studios.updateAsync(this.studio._id, { $set: m }))
		this.studio.mappingsWithOverrides.defaults[mappingId] = m['mappingsWithOverrides.defaults.' + mappingId] // Update local
		return mappingId
	}
	updateMapping(mappingId: string, mapping: Partial<BlueprintMapping>): void {
		check(mappingId, String)
		if (!this.studio.mappingsWithOverrides.defaults[mappingId]) {
			throw new Meteor.Error(404, `Mapping "${mappingId}" cannot be updated as it does not exist`)
		}

		if (mappingId) {
			const m: any = {}
			m['mappingsWithOverrides.defaults.' + mappingId] = _.extend(
				this.studio.mappingsWithOverrides.defaults[mappingId],
				mapping
			)
			waitForPromise(Studios.updateAsync(this.studio._id, { $set: m }))
			this.studio.mappingsWithOverrides.defaults[mappingId] = m['mappingsWithOverrides.defaults.' + mappingId] // Update local
		}
	}
	removeMapping(mappingId: string): void {
		check(mappingId, String)
		if (mappingId) {
			const m: any = {}
			m['mappingsWithOverrides.defaults.' + mappingId] = 1
			waitForPromise(Studios.updateAsync(this.studio._id, { $unset: m }))
			delete this.studio.mappingsWithOverrides.defaults[mappingId] // Update local
		}
	}

	getConfig(configId: string): ConfigItemValue | undefined {
		check(configId, String)
		if (configId === '') return undefined
		const configItem = objectPathGet(this.studio.blueprintConfigWithOverrides.defaults, configId)
		return trimIfString(configItem)
	}
	setConfig(configId: string, value: ConfigItemValue): void {
		check(configId, String)
		if (!configId) {
			throw new Meteor.Error(500, `Config id "${configId}" is invalid`)
		}

		value = trimIfString(value)

		let modifier: MongoModifier<DBStudio> = {}
		if (value === undefined) {
			modifier = {
				$unset: {
					[`blueprintConfigWithOverrides.defaults.${configId}`]: 1,
				},
			}
			objectPath.del(this.studio.blueprintConfigWithOverrides.defaults, configId) // Update local
		} else {
			modifier = {
				$set: {
					[`blueprintConfigWithOverrides.defaults.${configId}`]: value,
				},
			}
			objectPathSet(this.studio.blueprintConfigWithOverrides.defaults, configId, value) // Update local
		}
		waitForPromise(
			Studios.updateAsync(
				{
					_id: this.studio._id,
				},
				modifier
			)
		)
	}
	removeConfig(configId: string): void {
		check(configId, String)

		if (configId) {
			waitForPromise(
				Studios.updateAsync(
					{
						_id: this.studio._id,
					},
					{
						$unset: {
							[`blueprintConfigWithOverrides.defaults.${configId}`]: 1,
						},
					}
				)
			)
			// Update local:
			objectPath.del(this.studio.blueprintConfigWithOverrides.defaults, configId)
		}
	}

	getDevice(deviceId: string): TSR.DeviceOptionsAny | undefined {
		check(deviceId, String)

		const studio = waitForPromise(Studios.findOneAsync(this.studio._id))
		if (!studio || !studio.peripheralDeviceSettings.playoutDevices) return undefined

		const playoutDevices = studio.peripheralDeviceSettings.playoutDevices.defaults

		return playoutDevices[deviceId]?.options
	}
	insertDevice(deviceId: string, device: TSR.DeviceOptionsAny): string {
		check(deviceId, String)

		if (!deviceId) {
			throw new Meteor.Error(500, `Device id "${deviceId}" is invalid`)
		}

		const studio = waitForPromise(Studios.findOneAsync(this.studio._id))
		if (!studio || !studio.peripheralDeviceSettings.playoutDevices)
			throw new Meteor.Error(500, `Studio was not found`)

		const playoutDevices = studio.peripheralDeviceSettings.playoutDevices.defaults

		if (playoutDevices && playoutDevices[deviceId]) {
			throw new Meteor.Error(404, `Device "${deviceId}" cannot be inserted as it already exists`)
		}

		const parentDevice = waitForPromise(
			PeripheralDevices.findOneAsync(
				{
					type: PeripheralDeviceType.PLAYOUT,
					subType: PERIPHERAL_SUBTYPE_PROCESS,
					studioId: this.studio._id,
				},
				{
					sort: {
						created: 1,
					},
				}
			)
		)
		if (!parentDevice) {
			throw new Meteor.Error(404, `Device "${deviceId}" cannot be updated as it does not exist`)
		}

		waitForPromise(
			Studios.updateAsync(this.studio._id, {
				$set: {
					[`peripheralDeviceSettings.playoutDevices.defaults.${deviceId}`]: literal<StudioPlayoutDevice>({
						peripheralDeviceId: parentDevice._id,
						options: device,
					}),
				},
			})
		)

		return deviceId
	}
	updateDevice(deviceId: string, device: Partial<TSR.DeviceOptionsAny>): void {
		check(deviceId, String)

		if (!deviceId) {
			throw new Meteor.Error(500, `Device id "${deviceId}" is invalid`)
		}

		const studio = waitForPromise(Studios.findOneAsync(this.studio._id))
		if (!studio || !studio.peripheralDeviceSettings.playoutDevices)
			throw new Meteor.Error(500, `Studio was not found`)

		const playoutDevices = studio.peripheralDeviceSettings.playoutDevices.defaults

		if (!playoutDevices || !playoutDevices[deviceId]) {
			throw new Meteor.Error(404, `Device "${deviceId}" cannot be updated as it does not exist`)
		}

		const newOptions = _.extend(playoutDevices[deviceId].options, device)

		waitForPromise(
			Studios.updateAsync(this.studio._id, {
				$set: {
					[`peripheralDeviceSettings.playoutDevices.defaults.${deviceId}.options`]: newOptions,
				},
			})
		)
	}
	removeDevice(deviceId: string): void {
		check(deviceId, String)

		if (!deviceId) {
			throw new Meteor.Error(500, `Device id "${deviceId}" is invalid`)
		}

		waitForPromise(
			Studios.updateAsync(this.studio._id, {
				$unset: {
					[`peripheralDeviceSettings.playoutDevices.defaults.${deviceId}`]: 1,
				},
			})
		)
	}
}

export class MigrationContextShowStyle
	extends AbstractMigrationContextWithTriggeredActions
	implements IMigrationContextShowStyle
{
	private showStyleBase: ShowStyleBase
	constructor(showStyleBase: ShowStyleBase) {
		super()
		this.showStyleBaseId = showStyleBase._id
		this.showStyleBase = showStyleBase
	}

	getAllVariants(): IBlueprintShowStyleVariant[] {
		return waitForPromise(
			ShowStyleVariants.findFetchAsync({
				showStyleBaseId: this.showStyleBase._id,
			})
		).map((variant) => unprotectObject(variant)) as any
	}
	getVariantId(variantId: string): string {
		return getHash(this.showStyleBase._id + '_' + variantId)
	}
	private getProtectedVariantId(variantId: string): ShowStyleVariantId {
		return protectString<ShowStyleVariantId>(this.getVariantId(variantId))
	}
	private getVariantFromDb(variantId: string): ShowStyleVariant | undefined {
		const variant = waitForPromise(
			ShowStyleVariants.findOneAsync({
				showStyleBaseId: this.showStyleBase._id,
				_id: this.getProtectedVariantId(variantId),
			})
		)
		if (variant) return variant

		// Assume we were given the full id
		return waitForPromise(
			ShowStyleVariants.findOneAsync({
				showStyleBaseId: this.showStyleBase._id,
				_id: protectString(variantId),
			})
		)
	}
	getVariant(variantId: string): IBlueprintShowStyleVariant | undefined {
		check(variantId, String)
		if (!variantId) {
			throw new Meteor.Error(500, `Variant id "${variantId}" is invalid`)
		}

		return unprotectObject(this.getVariantFromDb(variantId)) as any
	}
	insertVariant(variantId: string, variant: OmitId<ShowStyleVariantPart>): string {
		check(variantId, String)
		if (!variantId) {
			throw new Meteor.Error(500, `Variant id "${variantId}" is invalid`)
		}

		return unprotectString(
			waitForPromise(
				ShowStyleVariants.insertAsync({
					...variant,
					_id: this.getProtectedVariantId(variantId),
					showStyleBaseId: this.showStyleBase._id,
					blueprintConfigWithOverrides: wrapDefaultObject({}),
					_rundownVersionHash: '',
					_rank: 0,
				})
			)
		)
	}
	updateVariant(variantId: string, newVariant: Partial<ShowStyleVariantPart>): void {
		check(variantId, String)
		if (!variantId) {
			throw new Meteor.Error(500, `Variant id "${variantId}" is invalid`)
		}
		const variant = this.getVariantFromDb(variantId)
		if (!variant) throw new Meteor.Error(404, `Variant "${variantId}" not found`)

		waitForPromise(ShowStyleVariants.updateAsync(variant._id, { $set: newVariant }))
	}
	removeVariant(variantId: string): void {
		check(variantId, String)
		if (!variantId) {
			throw new Meteor.Error(500, `Variant id "${variantId}" is invalid`)
		}

		waitForPromise(
			ShowStyleVariants.removeAsync({
				_id: this.getProtectedVariantId(variantId),
				showStyleBaseId: this.showStyleBase._id,
			})
		)
	}
	getSourceLayer(sourceLayerId: string): ISourceLayer | undefined {
		check(sourceLayerId, String)
		if (!sourceLayerId) {
			throw new Meteor.Error(500, `SourceLayer id "${sourceLayerId}" is invalid`)
		}

		return this.showStyleBase.sourceLayersWithOverrides.defaults[sourceLayerId]
	}
	insertSourceLayer(sourceLayerId: string, layer: OmitId<ISourceLayer>): string {
		check(sourceLayerId, String)
		if (!sourceLayerId) {
			throw new Meteor.Error(500, `SourceLayer id "${sourceLayerId}" is invalid`)
		}

		const oldLayer = this.showStyleBase.sourceLayersWithOverrides.defaults[sourceLayerId]
		if (oldLayer) {
			throw new Meteor.Error(500, `SourceLayer "${sourceLayerId}" already exists`)
		}

		const fullLayer: ISourceLayer = {
			...layer,
			_id: sourceLayerId,
		}
		waitForPromise(
			ShowStyleBases.updateAsync(
				{
					_id: this.showStyleBase._id,
				},
				{
					$set: {
						[`sourceLayersWithOverrides.defaults.${sourceLayerId}`]: fullLayer,
					},
				}
			)
		)
		this.showStyleBase.sourceLayersWithOverrides.defaults[sourceLayerId] = fullLayer // Update local
		return fullLayer._id
	}
	updateSourceLayer(sourceLayerId: string, layer: Partial<ISourceLayer>): void {
		check(sourceLayerId, String)
		if (!sourceLayerId) {
			throw new Meteor.Error(500, `SourceLayer id "${sourceLayerId}" is invalid`)
		}

		const oldLayer = this.showStyleBase.sourceLayersWithOverrides.defaults[sourceLayerId]
		if (!oldLayer) {
			throw new Meteor.Error(404, `SourceLayer "${sourceLayerId}" cannot be updated as it does not exist`)
		}

		const fullLayer = {
			...oldLayer,
			...layer,
		}
		waitForPromise(
			ShowStyleBases.updateAsync(
				{
					_id: this.showStyleBase._id,
					'sourceLayers._id': sourceLayerId,
				},
				{
					$set: {
						[`sourceLayersWithOverrides.defaults.${sourceLayerId}`]: fullLayer,
					},
				}
			)
		)
		this.showStyleBase.sourceLayersWithOverrides.defaults[sourceLayerId] = fullLayer // Update local
	}
	removeSourceLayer(sourceLayerId: string): void {
		check(sourceLayerId, String)
		if (!sourceLayerId) {
			throw new Meteor.Error(500, `SourceLayer id "${sourceLayerId}" is invalid`)
		}

		waitForPromise(
			ShowStyleBases.updateAsync(
				{
					_id: this.showStyleBase._id,
				},
				{
					$unset: {
						[`sourceLayersWithOverrides.defaults.${sourceLayerId}`]: 1,
					},
				}
			)
		)
		// Update local:
		delete this.showStyleBase.sourceLayersWithOverrides.defaults[sourceLayerId]
	}
	getOutputLayer(outputLayerId: string): IOutputLayer | undefined {
		check(outputLayerId, String)
		if (!outputLayerId) {
			throw new Meteor.Error(500, `OutputLayer id "${outputLayerId}" is invalid`)
		}

		return this.showStyleBase.outputLayersWithOverrides.defaults[outputLayerId]
	}
	insertOutputLayer(outputLayerId: string, layer: OmitId<IOutputLayer>): string {
		check(outputLayerId, String)
		if (!outputLayerId) {
			throw new Meteor.Error(500, `OutputLayer id "${outputLayerId}" is invalid`)
		}

		const oldLayer = this.showStyleBase.outputLayersWithOverrides.defaults[outputLayerId]
		if (oldLayer) {
			throw new Meteor.Error(500, `OutputLayer "${outputLayerId}" already exists`)
		}

		const fullLayer: IOutputLayer = {
			...layer,
			_id: outputLayerId,
		}
		waitForPromise(
			ShowStyleBases.updateAsync(
				{
					_id: this.showStyleBase._id,
				},
				{
					$set: {
						[`outputLayersWithOverrides.defaults.${outputLayerId}`]: fullLayer,
					},
				}
			)
		)

		this.showStyleBase.outputLayersWithOverrides.defaults[outputLayerId] = fullLayer // Update local
		return fullLayer._id
	}
	updateOutputLayer(outputLayerId: string, layer: Partial<IOutputLayer>): void {
		check(outputLayerId, String)
		if (!outputLayerId) {
			throw new Meteor.Error(500, `OutputLayer id "${outputLayerId}" is invalid`)
		}

		const oldLayer = this.showStyleBase.outputLayersWithOverrides.defaults[outputLayerId]
		if (!oldLayer) {
			throw new Meteor.Error(404, `OutputLayer "${outputLayerId}" cannot be updated as it does not exist`)
		}

		const fullLayer = {
			...oldLayer,
			...layer,
		}
		waitForPromise(
			ShowStyleBases.updateAsync(
				{
					_id: this.showStyleBase._id,
				},
				{
					$set: {
						[`outputLayersWithOverrides.defaults.${outputLayerId}`]: fullLayer,
					},
				}
			)
		)
		this.showStyleBase.outputLayersWithOverrides.defaults[outputLayerId] = fullLayer // Update local
	}
	removeOutputLayer(outputLayerId: string): void {
		check(outputLayerId, String)
		if (!outputLayerId) {
			throw new Meteor.Error(500, `OutputLayer id "${outputLayerId}" is invalid`)
		}

		waitForPromise(
			ShowStyleBases.updateAsync(
				{
					_id: this.showStyleBase._id,
				},
				{
					$unset: {
						[`outputLayersWithOverrides.defaults.${outputLayerId}`]: 1,
					},
				}
			)
		)
		// Update local:
		delete this.showStyleBase.outputLayersWithOverrides.defaults[outputLayerId]
	}
	getBaseConfig(configId: string): ConfigItemValue | undefined {
		check(configId, String)
		if (configId === '') return undefined
		const configItem = objectPathGet(this.showStyleBase.blueprintConfigWithOverrides.defaults, configId)
		return trimIfString(configItem)
	}
	setBaseConfig(configId: string, value: ConfigItemValue): void {
		check(configId, String)
		if (!configId) {
			throw new Meteor.Error(500, `Config id "${configId}" is invalid`)
		}

		if (_.isUndefined(value)) throw new Meteor.Error(400, `setBaseConfig "${configId}": value is undefined`)

		value = trimIfString(value)

		const modifier: MongoModifier<DBShowStyleBase> = {
			$set: {
				[`blueprintConfigWithOverrides.defaults.${configId}`]: value,
			},
		}
		waitForPromise(
			ShowStyleBases.updateAsync(
				{
					_id: this.showStyleBase._id,
				},
				modifier
			)
		)
		objectPathSet(this.showStyleBase.blueprintConfigWithOverrides.defaults, configId, value) // Update local
	}
	removeBaseConfig(configId: string): void {
		check(configId, String)
		if (configId) {
			waitForPromise(
				ShowStyleBases.updateAsync(
					{
						_id: this.showStyleBase._id,
					},
					{
						$unset: {
							[`blueprintConfigWithOverrides.defaults.${configId}`]: 1,
						},
					}
				)
			)
			// Update local:
			objectPath.del(this.showStyleBase.blueprintConfigWithOverrides.defaults, configId)
		}
	}
	getVariantConfig(variantId: string, configId: string): ConfigItemValue | undefined {
		check(variantId, String)
		check(configId, String)
		if (configId === '') return undefined

		const variant = this.getVariantFromDb(variantId)
		if (!variant) throw new Meteor.Error(404, `ShowStyleVariant "${variantId}" not found`)

		const configItem = objectPathGet(variant.blueprintConfigWithOverrides.defaults, configId)
		return trimIfString(configItem)
	}
	setVariantConfig(variantId: string, configId: string, value: ConfigItemValue): void {
		check(variantId, String)
		check(configId, String)
		if (!configId) {
			throw new Meteor.Error(500, `Config id "${configId}" is invalid`)
		}

		value = trimIfString(value)

		if (_.isUndefined(value))
			throw new Meteor.Error(400, `setVariantConfig "${variantId}", "${configId}": value is undefined`)

		const variant = this.getVariantFromDb(variantId)
		if (!variant) throw new Meteor.Error(404, `ShowStyleVariant "${variantId}" not found`)

		const modifier: MongoModifier<DBShowStyleVariant> = {
			$set: {
				[`blueprintConfigWithOverrides.defaults.${configId}`]: value,
			},
		}
		waitForPromise(
			ShowStyleVariants.updateAsync(
				{
					_id: variant._id,
				},
				modifier
			)
		)
		objectPathSet(variant.blueprintConfigWithOverrides.defaults, configId, value) // Update local
	}
	removeVariantConfig(variantId: string, configId: string): void {
		check(variantId, String)
		check(configId, String)

		if (configId) {
			const variant = this.getVariantFromDb(variantId)
			if (!variant) throw new Meteor.Error(404, `ShowStyleVariant "${variantId}" not found`)

			waitForPromise(
				ShowStyleVariants.updateAsync(
					{
						_id: variant._id,
					},
					{
						$unset: {
							[`blueprintConfigWithOverrides.defaults.${configId}`]: 1,
						},
					}
				)
			)
			// Update local:
			objectPath.del(variant.blueprintConfigWithOverrides.defaults, configId)
		}
	}
}
