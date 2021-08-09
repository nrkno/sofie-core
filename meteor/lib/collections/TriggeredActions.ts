import { Meteor } from 'meteor/meteor'
import { IBlueprintTriggeredActions, SomeBlueprintTrigger } from '@sofie-automation/blueprints-integration'
import { registerCollection, ProtectedString, ProtectedStringProperties } from '../lib'
import { ShowStyleBaseId } from './ShowStyleBases'
import { ObserveChangesForHash, createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { PeripheralDeviceId } from './PeripheralDevices'

/** A string, identifying a ShowStyleVariant */
export type TriggeredActionId = ProtectedString<'TriggeredActionId'>

export type DBBlueprintTrigger = SomeBlueprintTrigger & {
	deviceId?: PeripheralDeviceId
}

export interface DBTriggeredActions extends ProtectedStringProperties<IBlueprintTriggeredActions, '_id'> {
	_id: TriggeredActionId
	/** Id of parent ShowStyleBase. If undefined, this is a system-wide triggered action */
	showStyleBaseId: ShowStyleBaseId | undefined

	/** Triggers, with attached device info alongside */
	triggers: DBBlueprintTrigger[]

	_rundownVersionHash: string
}

export type TriggeredActionsObj = DBTriggeredActions
export const TriggeredActions = createMongoCollection<TriggeredActionsObj, DBTriggeredActions>('triggeredActions')
registerCollection('TriggeredActions', TriggeredActions)

registerIndex(TriggeredActions, {
	showStyleBaseId: 1,
})

Meteor.startup(() => {
	if (Meteor.isServer) {
		ObserveChangesForHash(TriggeredActions, '_rundownVersionHash', ['showStyleBaseId', 'triggers', 'actions'])
	}
})
