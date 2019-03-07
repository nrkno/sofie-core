import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection, applyClassToDocument } from '../lib'
import {
	IConfigItem,
	IBlueprintShowStyleBase,
	IOutputLayer,
	ISourceLayer,
	IBlueprintRuntimeArgumentsItem
} from 'tv-automation-sofie-blueprints-integration'
import { ObserveChangesForHash } from './lib'

export interface HotkeyDefinition {
	_id: string
	key: string
	label: string
}

export interface DBShowStyleBase extends IBlueprintShowStyleBase {
	_id: string
	/** Name of this show style */
	name: string
	/** Id of the blueprint used by this show-style */
	blueprintId: string

	/** "Outputs" in the UI */
	outputLayers: Array<IOutputLayer>
	/** "Layers" in the GUI */
	sourceLayers: Array<ISourceLayer>

	/** Config values are used by the Blueprints */
	config: Array<IConfigItem>

	hotkeyLegend?: Array<HotkeyDefinition>

	runtimeArguments?: Array<IBlueprintRuntimeArgumentsItem>

	_runningOrderVersionHash: string
}

export class ShowStyleBase implements DBShowStyleBase {
	public _id: string
	public name: string
	public blueprintId: string
	public outputLayers: Array<IOutputLayer>
	public sourceLayers: Array<ISourceLayer>
	public config: Array<IConfigItem>
	public hotkeyLegend?: Array<HotkeyDefinition>
	public runtimeArguments: Array<IBlueprintRuntimeArgumentsItem>
	public _runningOrderVersionHash: string

	constructor (document: DBShowStyleBase) {
		_.each(_.keys(document), (key) => {
			this[key] = document[key]
		})
	}
}

export const ShowStyleBases: TransformedCollection<ShowStyleBase, DBShowStyleBase>
	= new Mongo.Collection<ShowStyleBase>('showStyleBases', {transform: (doc) => applyClassToDocument(ShowStyleBase, doc) })
registerCollection('ShowStyleBases', ShowStyleBases)

Meteor.startup(() => {
	if (Meteor.isServer) {
		// ShowStyleBases._ensureIndex({
		// 	_id: 1,
		// })

		ObserveChangesForHash(ShowStyleBases, '_runningOrderVersionHash', ['config', 'blueprintId']) // TODO - more fields?
	}
})
