import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { Time, registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'

export interface UserActionsLogItem {
	_id: string,
	userId: string,
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
	= new Mongo.Collection<UserActionsLogItem>('userActionsLog')
registerCollection('UserActionsLog', UserActionsLog)

Meteor.startup(() => {
	if (Meteor.isServer) {
		UserActionsLog._ensureIndex({
			timestamp: 1
		})
	}
})
