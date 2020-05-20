import { TransformedCollection } from '../typings/meteor'
import { Time, registerCollection, ProtectedString } from '../lib'
import { Meteor } from 'meteor/meteor'
import { createMongoCollection } from './lib'

/** A string, identifying a UserActionsLogItem */
export type UserActionsLogItemId = ProtectedString<'UserActionsLogItemId'>

export interface UserActionsLogItem {
	_id: UserActionsLogItemId
	userId?: string,
	clientAddress: string,
	timestamp: Time,
	method: string,
	args: string,
	context: string,
	success?: boolean,
	doneTime?: Time,
	executionTime?: Time,
	errorMessage?: string
}

export const UserActionsLog: TransformedCollection<UserActionsLogItem, UserActionsLogItem>
	= createMongoCollection<UserActionsLogItem>('userActionsLog')
registerCollection('UserActionsLog', UserActionsLog)

Meteor.startup(() => {
	if (Meteor.isServer) {
		UserActionsLog._ensureIndex({
			timestamp: 1
		})
	}
})
