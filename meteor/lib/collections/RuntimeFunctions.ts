import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'

export interface RuntimeFunction {
	_id: string
	code: string
}

export const RuntimeFunctions: TransformedCollection<RuntimeFunction, RuntimeFunction>
	= new Mongo.Collection<RuntimeFunction>('runtimeFunctions')
