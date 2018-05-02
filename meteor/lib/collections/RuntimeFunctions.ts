import { Mongo } from 'meteor/mongo'

export interface RuntimeFunction {
	_id: string
	code: string
}

export const RuntimeFunctions = new Mongo.Collection<RuntimeFunction>('runtimeFunctions')
