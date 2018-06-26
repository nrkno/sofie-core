import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'

export interface RuntimeFunctionDebugDataObj {
	_id: string
	showStyleId: string
	templateId: string
	created: number
	dataHash: string
	data?: Array<any>
	dontRemove?: boolean
}

export const RuntimeFunctionDebugData: TransformedCollection<RuntimeFunctionDebugDataObj, RuntimeFunctionDebugDataObj>
	= new Mongo.Collection<RuntimeFunctionDebugDataObj>('runtimeFunctionDebugData')

Meteor.startup(() => {
	if (Meteor.isServer) {
		RuntimeFunctionDebugData._ensureIndex({
			showStyleId: 1,
			templateId: 1
		})
	}
})
