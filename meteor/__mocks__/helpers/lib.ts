import { TransformedCollection } from '../../lib/typings/meteor'
import * as _ from 'underscore'

/*
interface MockedCollection<T, Y extends any[]> {
	mockClear: jest.MockInstance<T, Y>['mockClear']
	mockReset: jest.MockInstance<T, Y>['mockReset']
}
*/
interface MockedCollection {
	mockClear: jest.MockInstance<void, any[]>['mockClear']
	mockReset: jest.MockInstance<void, any[]>['mockReset']
}

export function mockupCollection<A, B> (
	collection0: TransformedCollection<A, B>
) {

	const collection = collection0 as TransformedCollection<A, B> & MockedCollection

	const methodNames = [
		'allow',
		'deny',
		'find',
		'findOne',
		'insert',
		'rawCollection',
		'rawDatabase',
		'remove',
		'update',
		'upsert',
		'_ensureIndex',
		'_dropIndex'
	]
	_.each(methodNames, methodName => collection[methodName] = jest.fn(collection[methodName]))

	collection.mockClear = () => {
		_.each(methodNames, methodName => collection[methodName].mockClear())
	}
	collection.mockReset = () => {
		_.each(methodNames, methodName => collection[methodName].mockReset())
	}

	return collection
}
