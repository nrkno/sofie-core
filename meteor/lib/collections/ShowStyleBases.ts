import { Meteor } from 'meteor/meteor'
import { registerCollection, ProtectedStringProperties } from '../lib'
import { IBlueprintShowStyleBase } from '@sofie-automation/blueprints-integration'
import { ObserveChangesForHash, createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { ShowStyleBaseId, BlueprintId, OrganizationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { ShowStyleBaseId }

export interface HotkeyDefinition {
	_id: string
	key: string
	label: string
}
export interface DBShowStyleBase extends ProtectedStringProperties<IBlueprintShowStyleBase, '_id' | 'blueprintId'> {
	_id: ShowStyleBaseId

	/** Name of this show style */
	name: string
	/** Id of the blueprint used by this show-style */
	blueprintId: BlueprintId
	/** If set, the Organization that owns this ShowStyleBase */
	organizationId: OrganizationId | null

	hotkeyLegend?: Array<HotkeyDefinition>

	_rundownVersionHash: string
}

export type ShowStyleBase = DBShowStyleBase

export const ShowStyleBases = createMongoCollection<ShowStyleBase, DBShowStyleBase>('showStyleBases')
registerCollection('ShowStyleBases', ShowStyleBases)

registerIndex(ShowStyleBases, {
	organizationId: 1,
})

Meteor.startup(() => {
	if (Meteor.isServer) {
		ObserveChangesForHash(ShowStyleBases, '_rundownVersionHash', ['blueprintConfig', 'blueprintId'])
	}
})
