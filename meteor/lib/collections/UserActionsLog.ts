import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { Time } from '../lib'

export interface UserActionsLogItem {
	_id: string,
	userId: string,
	clientAddress: string,
	timestamp: Time,
	method: string,
	args: string
}

export const UserActionsLog: TransformedCollection<UserActionsLogItem, UserActionsLogItem>
	= new Mongo.Collection<UserActionsLogItem>('userActionsLog')
