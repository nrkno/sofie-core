import { Meteor } from 'meteor/meteor'
import { IBlueprintTriggeredActions, SomeBlueprintTrigger } from '@sofie-automation/blueprints-integration'
import { ProtectedStringProperties } from '../lib'
import { ShowStyleBaseId } from './ShowStyleBases'
import { ObserveChangesForHash, createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { PeripheralDeviceId } from './PeripheralDevices'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { TriggeredActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { TriggeredActionId }

export type DBBlueprintTrigger = SomeBlueprintTrigger & {
	deviceId?: PeripheralDeviceId
}

export interface DBTriggeredActions extends ProtectedStringProperties<IBlueprintTriggeredActions, '_id'> {
	_id: TriggeredActionId
	/** Id of parent ShowStyleBase. If null, this is a system-wide triggered action */
	showStyleBaseId: ShowStyleBaseId | null

	/** Triggers, with attached device info alongside */
	triggers: DBBlueprintTrigger[]

	_rundownVersionHash: string
}

/** Note: Use DBTriggeredActions instead */
export type TriggeredActionsObj = DBTriggeredActions
export const TriggeredActions = createMongoCollection<DBTriggeredActions>(CollectionName.TriggeredActions)

registerIndex(TriggeredActions, {
	showStyleBaseId: 1,
})

Meteor.startup(() => {
	if (Meteor.isServer) {
		ObserveChangesForHash(TriggeredActions, '_rundownVersionHash', ['showStyleBaseId', 'triggers', 'actions'])
	}
})
