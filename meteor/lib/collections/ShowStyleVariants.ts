import { Meteor } from 'meteor/meteor'
import { IBlueprintConfig, IBlueprintShowStyleVariant } from '@sofie-automation/blueprints-integration'
import { registerCollection, applyClassToDocument, ProtectedString, ProtectedStringProperties } from '../lib'
import { ShowStyleBase, ShowStyleBaseId } from './ShowStyleBases'
import { ObserveChangesForHash, createMongoCollection } from './lib'
import { registerIndex } from '../database'

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

export class ShowStyleVariant implements DBShowStyleVariant {
	public _id: ShowStyleVariantId
	public name: string
	public showStyleBaseId: ShowStyleBaseId
	public blueprintConfig: IBlueprintConfig
	public _rundownVersionHash: string

	constructor(document: DBShowStyleVariant) {
		for (const [key, value] of Object.entries(document)) {
			this[key] = value
		}
	}
}
export const ShowStyleVariants = createMongoCollection<ShowStyleVariant, DBShowStyleVariant>('showStyleVariants', {
	transform: (doc) => applyClassToDocument(ShowStyleVariant, doc),
})
registerCollection('ShowStyleVariants', ShowStyleVariants)

registerIndex(ShowStyleVariants, {
	showStyleBaseId: 1,
})

Meteor.startup(() => {
	if (Meteor.isServer) {
		ObserveChangesForHash(ShowStyleVariants, '_rundownVersionHash', ['blueprintConfig', 'showStyleBaseId'])
	}
})
