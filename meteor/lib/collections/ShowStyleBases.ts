import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection, applyClassToDocument, ProtectedString, ProtectedStringProperties } from '../lib'
import {
	IConfigItem,
	IBlueprintShowStyleBase,
	IOutputLayer,
	ISourceLayer,
	IBlueprintRuntimeArgumentsItem,
	SourceLayerType
} from 'tv-automation-sofie-blueprints-integration'
import { ObserveChangesForHash, createMongoCollection } from './lib'
import { BlueprintId } from './Blueprints'

export interface HotkeyDefinition {
	_id: string
	key: string
	label: string
	platformKey?: string
	sourceLayerType?: SourceLayerType
}
/** A string, identifying a ShowStyleBase */
export type ShowStyleBaseId = ProtectedString<'ShowStyleBaseId'>
export interface DBShowStyleBase extends ProtectedStringProperties<IBlueprintShowStyleBase, '_id' | 'blueprintId'> {
	/** Name of this show style */
	name: string
	/** Id of the blueprint used by this show-style */
	blueprintId: BlueprintId

	hotkeyLegend?: Array<HotkeyDefinition>

	runtimeArguments?: Array<IBlueprintRuntimeArgumentsItem>

	_rundownVersionHash: string
}

export class ShowStyleBase implements DBShowStyleBase {
	public _id: ShowStyleBaseId
	public name: string
	public blueprintId: BlueprintId
	public outputLayers: Array<IOutputLayer>
	public sourceLayers: Array<ISourceLayer>
	public config: Array<IConfigItem>
	public hotkeyLegend?: Array<HotkeyDefinition>
	public runtimeArguments: Array<IBlueprintRuntimeArgumentsItem>
	public _rundownVersionHash: string

	constructor (document: DBShowStyleBase) {
		_.each(_.keys(document), (key) => {
			this[key] = document[key]
		})
	}
}

export const ShowStyleBases: TransformedCollection<ShowStyleBase, DBShowStyleBase>
	= createMongoCollection<ShowStyleBase>('showStyleBases', { transform: (doc) => applyClassToDocument(ShowStyleBase, doc) })
registerCollection('ShowStyleBases', ShowStyleBases)

Meteor.startup(() => {
	if (Meteor.isServer) {
		// ShowStyleBases._ensureIndex({
		// 	_id: 1,
		// })

		ObserveChangesForHash(ShowStyleBases, '_rundownVersionHash', ['config', 'blueprintId'])
	}
})
