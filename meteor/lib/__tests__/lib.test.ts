import { Mongo } from 'meteor/mongo'
import { testInFiber } from '../../__mocks__/helpers/jest'
import { setLoggerLevel } from '../../server/api/logger'
import {
	getHash,
	MeteorPromiseCall,
	waitForPromise,
	getCurrentTime,
	systemTime,
	saveIntoDb,
	sumChanges,
	anythingChanged,
	literal,
	applyClassToDocument,
	formatDateAsTimecode,
	formatDurationAsTimecode,
	formatDateTime,
	removeNullyProperties,
	objectPathGet,
	objectPathSet,
	stringifyObjects,
	rateLimit,
	rateLimitAndDoItLater,
	rateLimitIgnore
} from '../lib'
import { setMeteorMethods } from '../../server/methods'
import { Timeline, TimelineObjType, TimelineObjGeneric } from '../collections/Timeline'
import { TSR } from 'tv-automation-sofie-blueprints-integration'

// require('../../../../../server/api/ingest/mosDevice/api.ts') // include in order to create the Meteor methods needed

describe('lib/lib', () => {

	testInFiber('getHash', () => {
		const h0 = getHash('abc')
		const h1 = getHash('abcd')
		const h2 = getHash('abc')

		expect(h0).toEqual(h2)
		expect(h0).not.toEqual(h1)
	})
	testInFiber('MeteorPromiseCall', () => {
		// set up method:
		setMeteorMethods({
			'myMethod': (value: any) => {
				// Do an async operation, to ensure that asynchronous operations work:
				const v = waitForPromise(new Promise(resolve => {
					setTimeout(() => {
						resolve(value)
					}, 10)
				}))
				return v
			}
		})
		const pValue: any = MeteorPromiseCall('myMethod', 'myValue').catch(e => { throw e })
		expect(pValue).toHaveProperty('then') // be a promise
		const value = waitForPromise(pValue)
		expect(value).toEqual('myValue')
	})
	testInFiber('getCurrentTime', () => {
		systemTime.diff = 5439
		expect(getCurrentTime() / 1000).toBeCloseTo((Date.now() - 5439) / 1000, 1)
	})
	testInFiber('saveIntoDb', () => {

		Timeline.insert({
			_id: 'abc',
			id: 'abc',
			enable: {
				start: 0
			},
			layer: 'L1',
			content: { deviceType: TSR.DeviceType.ABSTRACT },
			objectType: TimelineObjType.MANUAL,
			studioId: 'myStudio',
			classes: ['abc'] // to be removed
		})
		Timeline.insert({
			_id: 'abc2',
			id: 'abc2',
			enable: {
				start: 0
			},
			layer: 'L1',
			content: { deviceType: TSR.DeviceType.ABSTRACT },
			objectType: TimelineObjType.MANUAL,
			studioId: 'myStudio'
		})
		Timeline.insert({
			_id: 'abc10',
			id: 'abc10',
			enable: {
				start: 0
			},
			layer: 'L1',
			content: { deviceType: TSR.DeviceType.ABSTRACT },
			objectType: TimelineObjType.MANUAL,
			studioId: 'myStudio2'
		})

		const options = {
			beforeInsert: jest.fn((o) => o),
			beforeUpdate: jest.fn((o, pre) => o),
			beforeRemove: jest.fn((o) => o),
			beforeDiff: jest.fn((o, oldObj) => o),
			// insert: jest.fn((o) => o),
			// update: jest.fn((id, o,) => { return undefined }),
			// remove: jest.fn((o) => { return undefined }),
			afterInsert: jest.fn((o) => { return undefined }),
			afterUpdate: jest.fn((o) => { return undefined }),
			afterRemove: jest.fn((o) => { return undefined }),
		}

		const changes = saveIntoDb(Timeline, {
			studioId: 'myStudio'
		}, [
			{
				_id: 'abc',
				id: 'abc',
				enable: {
					start: 0
				},
				layer: 'L2', // changed property
				content: { deviceType: TSR.DeviceType.ABSTRACT },
				objectType: TimelineObjType.MANUAL,
				studioId: 'myStudio'
			},
			{ // insert object
				_id: 'abc3',
				id: 'abc3',
				enable: {
					start: 0
				},
				layer: 'L1',
				content: { deviceType: TSR.DeviceType.ABSTRACT },
				objectType: TimelineObjType.MANUAL,
				studioId: 'myStudio'
			}
			// remove abc2
		], options)

		expect(Timeline.find({
			studioId: 'myStudio'
		}).count()).toEqual(2)
		const abc = Timeline.findOne('abc') as TimelineObjGeneric
		expect(abc).toBeTruthy()
		expect(abc.classes).toEqual(undefined)
		expect(abc.layer).toEqual('L2')

		expect(Timeline.find({
			studioId: 'myStudio2'
		}).count()).toEqual(1)

		expect(options.beforeInsert).toHaveBeenCalledTimes(1)
		expect(options.beforeUpdate).toHaveBeenCalledTimes(1)
		expect(options.beforeRemove).toHaveBeenCalledTimes(1)
		expect(options.beforeDiff).toHaveBeenCalledTimes(1)
		// expect(options.insert).toHaveBeenCalledTimes(1)
		// expect(options.update).toHaveBeenCalledTimes(1)
		// expect(options.remove).toHaveBeenCalledTimes(1)
		expect(options.afterInsert).toHaveBeenCalledTimes(1)
		expect(options.afterUpdate).toHaveBeenCalledTimes(1)
		expect(options.afterRemove).toHaveBeenCalledTimes(1)

		expect(changes).toMatchObject({
			added: 1,
			updated: 1,
			removed: 1
		})
		expect(sumChanges({
			added: 1,
			updated: 2,
			removed: 3
		},changes)).toMatchObject({
			added: 2,
			updated: 3,
			removed: 4
		})
	})
	testInFiber('anythingChanged', () => {
		expect(anythingChanged({
			added: 0,
			updated: 0,
			removed: 0,
		})).toBeFalsy()
		expect(anythingChanged({
			added: 1,
			updated: 0,
			removed: 0,
		})).toBeTruthy()
		expect(anythingChanged({
			added: 0,
			updated: 9,
			removed: 0,
		})).toBeTruthy()
		expect(anythingChanged({
			added: 0,
			updated: 0,
			removed: 547,
		})).toBeTruthy()
	})
	testInFiber('literal', () => {
		const obj = literal<TimelineObjGeneric>({
			_id: 'abc',
			id: 'abc',
			enable: {
				start: 0
			},
			layer: 'L1',
			content: { deviceType: TSR.DeviceType.ABSTRACT },
			objectType: TimelineObjType.MANUAL,
			studioId: 'myStudio',
		})
		expect(obj).toEqual({
			_id: 'abc',
			id: 'abc',
			enable: {
				start: 0
			},
			layer: 'L1',
			content: { deviceType: TSR.DeviceType.ABSTRACT },
			objectType: TimelineObjType.MANUAL,
			studioId: 'myStudio',
		})
		const layer: string | number = obj.layer // just to check typings
		expect(layer).toBeTruthy()
	})
	testInFiber('applyClassToDocument', () => {
		class MyClass {
			public publ: string
			private priv: string
			constructor (from) {
				Object.keys(from).forEach(key => {
					this[key] = from[key]
				})
			}
			getPriv () { return this.priv }
			getPubl () { return this.publ }
		}
		const doc = applyClassToDocument(MyClass, {
			priv: 'aaa',
			publ: 'bbb'
		})
		expect(doc.getPriv()).toEqual('aaa')
		expect(doc.getPubl()).toEqual('bbb')
	})
	testInFiber('formatDateAsTimecode', () => {
		const d = new Date('2019-01-01 13:04:15.145')
		expect(d.getMilliseconds()).toEqual(145)
		expect(formatDateAsTimecode(d)).toEqual('13:04:15:03')
	})
	testInFiber('formatDurationAsTimecode', () => {
		expect(formatDurationAsTimecode((2 * 3600 + 5 * 60 + 7) * 1000 + 500)).toEqual('02:05:07:12')
	})
	testInFiber('formatDateTime', () => {
		expect(formatDateTime(1556194064374)).toMatch(/2019-04-\d{2} \d{2}:\d{2}:\d{2}/)
	})
	testInFiber('removeNullyProperties', () => {
		expect(removeNullyProperties({
			a: 1,
			b: 2,
			c: null,
			e: undefined,
			f: {
				a: 1,
				b: 2,
				c: null,
				e: undefined
			}
		})).toEqual({
			a: 1,
			b: 2,
			e: undefined,
			f: {
				a: 1,
				b: 2,
				e: undefined
			}
		})
	})
	testInFiber('objectPathGet', () => {
		expect(objectPathGet({
			a: 1,
			b: {
				c: 1,
				d: {
					e: 2
				}
			}
		}, 'b.d.e')).toEqual(2)
	})
	testInFiber('objectPathSet', () => {
		const o: any = {
			a: 1,
			b: {
				c: 1,
				d: {
					e: 2
				}
			}
		}
		objectPathSet(o, 'b.d.f', 42)
		expect(o.b.d.f).toEqual(42)
	})
	testInFiber('stringifyObjects', () => {
		const o: any = {
			a: 1,
			b: {
				c: '1',
				d: {
					e: 2
				}
			}
		}
		expect(stringifyObjects(o)).toEqual(stringifyObjects(o))
	})
	testInFiber('rateLimit', () => {
		const f0 = jest.fn()
		const f1 = jest.fn()
		rateLimit('test', f0, f1, 500)
		rateLimit('test', f0, f1, 500)
		rateLimit('test', f0, f1, 500)
		expect(f0).toHaveBeenCalledTimes(1)
		expect(f1).toHaveBeenCalledTimes(2)
	})
	testInFiber('rateLimitAndDoItLater', () => {
		const f0 = jest.fn()
		rateLimitAndDoItLater('test', f0, 10)
		rateLimitAndDoItLater('test', f0, 10)
		rateLimitAndDoItLater('test', f0, 10)
		rateLimitAndDoItLater('test', f0, 10)
		expect(f0).toHaveBeenCalledTimes(1)
		waitForPromise(new Promise(resolve => setTimeout(resolve, 100)))
		expect(f0).toHaveBeenCalledTimes(4)
	})
	testInFiber('rateLimitIgnore', () => {
		const f0 = jest.fn()
		rateLimitIgnore('test', f0, 10)
		rateLimitIgnore('test', f0, 10)
		rateLimitIgnore('test', f0, 10)
		rateLimitIgnore('test', f0, 10)
		expect(f0).toHaveBeenCalledTimes(1)
		waitForPromise(new Promise(resolve => setTimeout(resolve, 100)))
		expect(f0).toHaveBeenCalledTimes(2)
	})
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
