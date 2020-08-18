import { Meteor } from 'meteor/meteor'
import { ProtectedString, registerCollection, Time } from '../lib'
import { TransformedCollection } from '../typings/meteor'
import { createMongoCollection } from './lib'
import { OrganizationId } from './Organization'
import { UserId } from './Users'

/** A string, identifying a UserActionsLogItem */
export type UserActionsLogItemId = ProtectedString<'UserActionsLogItemId'>

export interface UserActionsLogItem {
	_id: UserActionsLogItemId

	organizationId: OrganizationId | null
	/** The user from which the action originated */
	userId: UserId | null
	/** The cliend address (IP-address) of the requester */
	clientAddress: string
	timestamp: Time
	method: string
	args: string
	context: string
	success?: boolean
	doneTime?: Time
	executionTime?: Time
	errorMessage?: string
}

export const UserActionsLog: TransformedCollection<UserActionsLogItem, UserActionsLogItem> = createMongoCollection<
	UserActionsLogItem
>('userActionsLog')
registerCollection('UserActionsLog', UserActionsLog)

Meteor.startup(() => {
	if (Meteor.isServer) {
		UserActionsLog._ensureIndex({
			organizationId: 1,
			timestamp: 1,
		})
	}
})
