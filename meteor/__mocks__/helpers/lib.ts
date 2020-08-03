import { TransformedCollection } from '../../lib/typings/meteor'
import * as _ from 'underscore'
import { ProtectedString } from '../../lib/lib'

/*
interface MockedCollection<T, Y extends any[]> {
	mockClear: jest.MockInstance<T, Y>['mockClear']
	mockReset: jest.MockInstance<T, Y>['mockReset']
}
*/
interface MockedCollection {
	mockClear: () => void
	mockReset: () => void
}

export function mockupCollection<A extends B, B extends { _id: ProtectedString<any> }>(
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
		'_dropIndex',
	]
	_.each(methodNames, (methodName) => (collection[methodName] = jest.fn(collection[methodName])))

	collection.mockClear = () => {
		_.each(methodNames, (methodName) => collection[methodName].mockClear())
	}
	collection.mockReset = () => {
		_.each(methodNames, (methodName) => collection[methodName].mockReset())
	}

	return collection
}
