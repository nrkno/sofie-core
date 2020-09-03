import { TransformedCollection } from '../typings/meteor'
import { Time, registerCollection, ProtectedString } from '../lib'
import { Meteor } from 'meteor/meteor'
import { createMongoCollection } from './lib'
import { UserId } from './Users'
import { OrganizationId } from './Organization'
import { registerIndex } from '../database'

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

registerIndex(UserActionsLog, {
	organizationId: 1,
	timestamp: 1,
})
