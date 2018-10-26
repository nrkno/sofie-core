import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { Time, registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'

export interface RuntimeFunctionDebugDataObj {
	_id: string
	/** The id of the showStyle this RTFDD belongs to */
	showStyleId: string
	/** The templateId of the RuntimeFunction this RTFDD belongs to */
	templateId: string
	/** Time of creation */
	created: Time
	/** A hash of the .data, to easilly look for changes */
	dataHash: string
	/** Reason for creating this RTFDD (human-readable) */
	reason: string
	/** Data */
	data?: Array<any>
	/** If true, prevents the RTFDD from being removed when cleaning up */
	dontRemove?: boolean
}

export const RuntimeFunctionDebugData: TransformedCollection<RuntimeFunctionDebugDataObj, RuntimeFunctionDebugDataObj>
	= new Mongo.Collection<RuntimeFunctionDebugDataObj>('runtimeFunctionDebugData')
registerCollection('RuntimeFunctionDebugData', RuntimeFunctionDebugData)
Meteor.startup(() => {
	if (Meteor.isServer) {
		RuntimeFunctionDebugData._ensureIndex({
			showStyleId: 1,
			templateId: 1
		})
	}
})
