import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'

export interface RuntimeFunction {
	_id: string
	showStyleId: string
	templateId: string
	isHelper: boolean
	code: string
	createdVersion: number
	modified: number
	active: true
}

export const RuntimeFunctions: TransformedCollection<RuntimeFunction, RuntimeFunction>
	= new Mongo.Collection<RuntimeFunction>('runtimeFunctions')
Meteor.startup(() => {
	if (Meteor.isServer) {
		RuntimeFunctions._ensureIndex({
			showStyleId: 1,
			templateId: 1
		})
	}
})
