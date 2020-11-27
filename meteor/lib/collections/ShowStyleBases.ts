import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection, applyClassToDocument, ProtectedString, ProtectedStringProperties } from '../lib'
import {
	IBlueprintConfig,
	IBlueprintShowStyleBase,
	IOutputLayer,
	ISourceLayer,
	SourceLayerType,
} from 'tv-automation-sofie-blueprints-integration'
import { ObserveChangesForHash, createMongoCollection } from './lib'
import { BlueprintId } from './Blueprints'
import { OrganizationId } from './Organization'
import { registerIndex } from '../database'

export interface HotkeyDefinition {
	_id: string
	key: string
	label: string
	platformKey?: string
	sourceLayerType?: SourceLayerType
	buttonColor?: string
}
/** A string, identifying a ShowStyleBase */
export type ShowStyleBaseId = ProtectedString<'ShowStyleBaseId'>
export interface DBShowStyleBase extends ProtectedStringProperties<IBlueprintShowStyleBase, '_id' | 'blueprintId'> {
	/** Name of this show style */
	name: string
	/** Id of the blueprint used by this show-style */
	blueprintId: BlueprintId
	/** If set, the Organization that owns this ShowStyleBase */
	organizationId: OrganizationId | null

	hotkeyLegend?: Array<HotkeyDefinition>

	_rundownVersionHash: string
}

export class ShowStyleBase implements DBShowStyleBase {
	public _id: ShowStyleBaseId
	public name: string
	public organizationId: OrganizationId | null
	public blueprintId: BlueprintId
	public outputLayers: Array<IOutputLayer>
	public sourceLayers: Array<ISourceLayer>
	public blueprintConfig: IBlueprintConfig
	public hotkeyLegend?: Array<HotkeyDefinition>
	public _rundownVersionHash: string

	constructor(document: DBShowStyleBase) {
		for (let [key, value] of Object.entries(document)) {
			this[key] = value
		}
	}
}

export const ShowStyleBases: TransformedCollection<ShowStyleBase, DBShowStyleBase> = createMongoCollection<
	ShowStyleBase
>('showStyleBases', { transform: (doc) => applyClassToDocument(ShowStyleBase, doc) })
registerCollection('ShowStyleBases', ShowStyleBases)

registerIndex(ShowStyleBases, {
	organizationId: 1,
})

Meteor.startup(() => {
	if (Meteor.isServer) {
		ObserveChangesForHash(ShowStyleBases, '_rundownVersionHash', ['blueprintConfig', 'blueprintId'])
	}
})
