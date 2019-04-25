import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import { Mongo } from 'meteor/mongo'
import { testInFiber } from '../../__mocks__/helpers/jest'
import {
	setupMockPeripheralDevice,
	setupMockStudio,
	setupMockShowStyleBase,
	setupMockShowStyleVariant,
	setupMockStudioBlueprint,
	setupMockShowStyleBlueprint
} from '../../__mocks__/helpers/database'
import { Rundowns } from '../../lib/collections/Rundowns'
import { setLoggerLevel } from '../../server/api/logger'

// require('../../../../../server/api/ingest/mosDevice/api.ts') // include in order to create the Meteor methods needed

describe('lib/lib', () => {

	testInFiber('mongowhere', () => {
		setLoggerLevel('debug')

		// mongoWhere is used my Collection mock
		const MyCollection = new Mongo.Collection<any>('mycollection')

		expect(MyCollection.findOne()).toBeFalsy()

		MyCollection.insert({
			_id: 'id0',
			name: 'abc',
			rank: 0
		})
		MyCollection.insert({
			_id: 'id1',
			name: 'abc',
			rank: 1
		})
		MyCollection.insert({
			_id: 'id2',
			name: 'abcd',
			rank: 2
		})
		MyCollection.insert({
			_id: 'id3',
			name: 'abcd',
			rank: 3
		})
		MyCollection.insert({
			_id: 'id4',
			name: 'xyz',
			rank: 4
		})
		MyCollection.insert({
			_id: 'id5',
			name: 'xyz',
			rank: 5
		})

		expect(MyCollection.find().fetch()).toHaveLength(6)

		expect(MyCollection.find({ _id: 'id3' }).fetch()).toHaveLength(1)
		expect(MyCollection.find({ _id: 'id99' }).fetch()).toHaveLength(0)

		expect(MyCollection.find({ name: 'abcd' }).fetch()).toHaveLength(2)
		expect(MyCollection.find({ name: 'xyz' }).fetch()).toHaveLength(2)
		expect(MyCollection.find({ name: { $in: ['abc', 'xyz'] } }).fetch()).toHaveLength(4)

		expect(MyCollection.find({ rank: { $gt: 2 } }).fetch()).toHaveLength(3)
		expect(MyCollection.find({ rank: { $gte: 2 } }).fetch()).toHaveLength(4)

		expect(MyCollection.find({ rank: { $lt: 3 } }).fetch()).toHaveLength(3)
		expect(MyCollection.find({ rank: { $lte: 3 } }).fetch()).toHaveLength(4)

	})
})
