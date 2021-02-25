import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { TransformedCollection } from '../typings/meteor'
import { IBlueprintConfig, IBlueprintShowStyleVariant } from '@sofie-automation/blueprints-integration'
import { registerCollection, applyClassToDocument, ProtectedString, ProtectedStringProperties } from '../lib'
import { ShowStyleBase, ShowStyleBases, ShowStyleBaseId } from './ShowStyleBases'
import { ObserveChangesForHash, createMongoCollection } from './lib'
import deepmerge from 'deepmerge'
import { registerIndex } from '../database'
import { ReadonlyDeep } from 'type-fest'
import { DBRundown } from './Rundowns'

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
export async function getShowStyleCompoundForRundown(
	rundown: Pick<ReadonlyDeep<DBRundown>, '_id' | 'showStyleBaseId' | 'showStyleVariantId'>
): Promise<ShowStyleCompound> {
	const [showStyleBase, showStyleVariant] = await Promise.all([
		asyncCollectionFindOne(ShowStyleBases, { _id: rundown.showStyleBaseId }),
		asyncCollectionFindOne(ShowStyleVariants, { _id: rundown.showStyleVariantId }),
	])
	if (!showStyleBase)
		throw new Meteor.Error(404, `ShowStyleBase "${rundown.showStyleBaseId}" for Rundown "${rundown._id}" not found`)
	if (!showStyleVariant)
		throw new Meteor.Error(
			404,
			`ShowStyleVariant "${rundown.showStyleVariantId}" for Rundown "${rundown._id}" not found`
		)

	const compound = createShowStyleCompound(showStyleBase, showStyleVariant)
	if (!compound)
		throw new Meteor.Error(
			404,
			`Failed to compile ShowStyleCompound for base "${rundown.showStyleBaseId}" and variant  "${rundown.showStyleVariantId}"`
		)

	return compound
}

export function createShowStyleCompound(
	showStyleBase: ShowStyleBase,
	showStyleVariant: ShowStyleVariant
): ShowStyleCompound | undefined {
	if (showStyleBase._id !== showStyleVariant.showStyleBaseId) return undefined

	let configs = deepmerge(showStyleBase.blueprintConfig, showStyleVariant.blueprintConfig, {
		arrayMerge: (_destinationArray, sourceArray, _options) => sourceArray,
	})

	return {
		...showStyleBase,
		showStyleVariantId: showStyleVariant._id,
		name: `${showStyleBase.name}-${showStyleVariant.name}`,
		blueprintConfig: configs,
		_rundownVersionHash: showStyleBase._rundownVersionHash,
		_rundownVersionHashVariant: showStyleVariant._rundownVersionHash,
	}
}

export class ShowStyleVariant implements DBShowStyleVariant {
	public _id: ShowStyleVariantId
	public name: string
	public showStyleBaseId: ShowStyleBaseId
	public blueprintConfig: IBlueprintConfig
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

registerIndex(ShowStyleVariants, {
	showStyleBaseId: 1,
})

Meteor.startup(() => {
	if (Meteor.isServer) {
		ObserveChangesForHash(ShowStyleVariants, '_rundownVersionHash', ['blueprintConfig', 'showStyleBaseId'])
	}
})
