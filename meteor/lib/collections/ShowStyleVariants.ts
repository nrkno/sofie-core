import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { TransformedCollection } from '../typings/meteor'
import { IConfigItem, IBlueprintShowStyleVariant } from 'tv-automation-sofie-blueprints-integration'
import { registerCollection, applyClassToDocument, ProtectedString, ProtectedStringProperties } from '../lib'
import { ShowStyleBase, ShowStyleBases, ShowStyleBaseId } from './ShowStyleBases'
import { ObserveChangesForHash, createMongoCollection } from './lib'

/** A string, identifying a ShowStyleVariant */
export type ShowStyleVariantId = ProtectedString<'ShowStyleVariantId'>

export interface DBShowStyleVariant extends ProtectedStringProperties<IBlueprintShowStyleVariant, '_id'> {
	_id: ShowStyleVariantId
	/** Id of parent ShowStyleBase */
	showStyleBaseId: ShowStyleBaseId

	_rundownVersionHash: string
}

export interface ShowStyleCompound extends ShowStyleBase {
	showStyleVariantId: ShowStyleVariantId
	_rundownVersionHashVariant: string
}
export function getShowStyleCompound(showStyleVariantId: ShowStyleVariantId): ShowStyleCompound | undefined {
	const showStyleVariant = ShowStyleVariants.findOne(showStyleVariantId)
	if (!showStyleVariant) return undefined
	const showStyleBase = ShowStyleBases.findOne(showStyleVariant.showStyleBaseId)
	if (!showStyleBase) return undefined

	return createShowStyleCompound(showStyleBase, showStyleVariant)
}

export function createShowStyleCompound(
	showStyleBase: ShowStyleBase,
	showStyleVariant: ShowStyleVariant
): ShowStyleCompound | undefined {
	if (showStyleBase._id !== showStyleVariant.showStyleBaseId) return undefined

	let configs: { [id: string]: IConfigItem } = {}
	_.each(showStyleBase.config, (config: IConfigItem) => {
		configs[config._id] = config
	})
	// Override base configs with variant configs:
	_.each(showStyleVariant.config, (config: IConfigItem) => {
		configs[config._id] = config
	})

	return {
		...showStyleBase,
		showStyleVariantId: showStyleVariant._id,
		name: `${showStyleBase.name}-${showStyleVariant.name}`,
		config: _.values(configs),
		_rundownVersionHash: showStyleBase._rundownVersionHash,
		_rundownVersionHashVariant: showStyleVariant._rundownVersionHash,
	}
}

export class ShowStyleVariant implements DBShowStyleVariant {
	public _id: ShowStyleVariantId
	public name: string
	public showStyleBaseId: ShowStyleBaseId
	public config: Array<IConfigItem>
	public _rundownVersionHash: string

	constructor(document: DBShowStyleVariant) {
		for (let [key, value] of Object.entries(document)) {
			this[key] = value
		}
	}
}
export const ShowStyleVariants: TransformedCollection<ShowStyleVariant, DBShowStyleVariant> = createMongoCollection<
	ShowStyleVariant
>('showStyleVariants', { transform: (doc) => applyClassToDocument(ShowStyleVariant, doc) })
registerCollection('ShowStyleVariants', ShowStyleVariants)
Meteor.startup(() => {
	if (Meteor.isServer) {
		ShowStyleVariants._ensureIndex({
			showStyleBaseId: 1,
		})
	}
})

Meteor.startup(() => {
	if (Meteor.isServer) {
		ObserveChangesForHash(ShowStyleVariants, '_rundownVersionHash', ['config', 'showStyleBaseId'])
	}
})
