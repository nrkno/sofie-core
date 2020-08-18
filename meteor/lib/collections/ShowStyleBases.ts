import { Meteor } from 'meteor/meteor'
import {
	IBlueprintRuntimeArgumentsItem,
	IBlueprintShowStyleBase,
	IConfigItem,
	IOutputLayer,
	ISourceLayer,
} from 'tv-automation-sofie-blueprints-integration'
import { applyClassToDocument, ProtectedString, ProtectedStringProperties, registerCollection } from '../lib'
import { TransformedCollection } from '../typings/meteor'
import { BlueprintId } from './Blueprints'
import { createMongoCollection, ObserveChangesForHash } from './lib'
import { OrganizationId } from './Organization'

export interface HotkeyDefinition {
	_id: string
	key: string
	label: string
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

	runtimeArguments?: Array<IBlueprintRuntimeArgumentsItem>

	_rundownVersionHash: string
}

export class ShowStyleBase implements DBShowStyleBase {
	public _id: ShowStyleBaseId
	public name: string
	public organizationId: OrganizationId | null
	public blueprintId: BlueprintId
	public outputLayers: Array<IOutputLayer>
	public sourceLayers: Array<ISourceLayer>
	public config: Array<IConfigItem>
	public hotkeyLegend?: Array<HotkeyDefinition>
	public runtimeArguments: Array<IBlueprintRuntimeArgumentsItem>
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

Meteor.startup(() => {
	if (Meteor.isServer) {
		ShowStyleBases._ensureIndex({
			organizationId: 1,
		})

		ObserveChangesForHash(ShowStyleBases, '_rundownVersionHash', ['config', 'blueprintId'])
	}
})
