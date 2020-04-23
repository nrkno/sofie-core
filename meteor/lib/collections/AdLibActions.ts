import { PieceGeneric } from './Pieces'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection, ProtectedStringProperties, Omit, ProtectedString } from '../lib'
import { Meteor } from 'meteor/meteor'
import { IBlueprintActionManifest } from 'tv-automation-sofie-blueprints-integration'
import { createMongoCollection } from './lib'
import { PartId } from './Parts';
import { RundownId } from './Rundowns';

/** A string, identifying an AdLibActionId */
export type AdLibActionId = ProtectedString<'AdLibActionId'>

export interface AdLibActionCommon extends IBlueprintActionManifest {
	rundownId: RundownId
}

export interface AdLibAction extends AdLibActionCommon {
	_id: AdLibActionId
	partId: PartId
}

export const AdLibActions: TransformedCollection<AdLibAction, AdLibAction>
	= createMongoCollection<AdLibAction>('adLibActions')
registerCollection('AdLibActions', AdLibActions)
Meteor.startup(() => {
	if (Meteor.isServer) {
		AdLibActions._ensureIndex({
			rundownId: 1,
			partId: 1,
			_rank: 1
		})
	}
})
