import { TransformedCollection } from '../typings/meteor'
import { registerCollection, ProtectedStringProperties, ProtectedString } from '../lib'
import { IBlueprintActionManifest } from 'tv-automation-sofie-blueprints-integration'
import { createMongoCollection } from './lib'
import { PartId } from './Parts'
import { RundownId } from './Rundowns'
import { registerIndex } from '../database'

/** A string, identifying an AdLibActionId */
export type AdLibActionId = ProtectedString<'AdLibActionId'>

export interface AdLibActionCommon extends ProtectedStringProperties<IBlueprintActionManifest, 'partId'> {
	rundownId: RundownId
}

export interface AdLibAction extends AdLibActionCommon {
	_id: AdLibActionId
	partId: PartId
}

export const AdLibActions: TransformedCollection<AdLibAction, AdLibAction> = createMongoCollection<AdLibAction>(
	'adLibActions'
)
registerCollection('AdLibActions', AdLibActions)
registerIndex(AdLibActions, {
	rundownId: 1,
	partId: 1,
})
