import { Meteor } from 'meteor/meteor'
import { RandomMock } from '../../__mocks__/random'
import { MongoMock } from '../../__mocks__/mongo'
import { waitForPromise, protectString, waitTime, getRandomString } from '../../lib/lib'
import { testInFiber } from '../../__mocks__/helpers/jest'
import {
	AdLibPieces,
	Blueprints,
	CoreSystem,
	Evaluations,
	ExpectedMediaItems,
	ExternalMessageQueue,
	IngestDataCache,
	MediaObjects,
	MediaWorkFlows,
	MediaWorkFlowSteps,
	Parts,
	PeripheralDeviceCommands,
	PeripheralDevices,
	Pieces,
	RundownBaselineAdLibPieces,
	RundownBaselineObjs,
	Rundowns,
	Segments,
	ShowStyleBases,
	ShowStyleVariants,
	Snapshots,
	Studios,
	Timeline,
	UserActionsLog,
} from '../collections'
import { DBStudio } from '../../lib/collections/Studios'
import { isInFiber } from '../../__mocks__/Fibers'
import { Mongo } from 'meteor/mongo'
import { defaultStudio } from '../../__mocks__/defaultCollectionObjects'

describe('Basic test of test environment', () => {
	testInFiber('Check that tests will run in fibers correctly', () => {
		// This code runs in a fiber
		expect(isInFiber()).toBeTruthy()

		const val = asynchronousFibersFunction(1, 2, 3)
		expect(val).toEqual(1 + 2 + 3)

		const p = Promise.resolve()
			.then(() => {
				expect(isInFiber()).toBeTruthy()
				return 'a'
			})
			.then(async (innerVal) => {
				return new Promise((resolve) => {
					expect(isInFiber()).toBeTruthy()
					resolve(innerVal)
				})
			})
		expect(waitForPromise(p)).toEqual('a')
	})
	test('Meteor Random mock', () => {
		RandomMock.mockIds = ['superRandom']
		expect(tempTestRandom()).toEqual('superRandom')
	})
	test('Verify Mock collections', () => {
		// @ts-ignore
		expect(AdLibPieces._isMock).toBeTruthy()
		// @ts-ignore
		expect(Blueprints._isMock).toBeTruthy()
		// @ts-ignore
		expect(CoreSystem._isMock).toBeTruthy()
		// @ts-ignore
		expect(Evaluations._isMock).toBeTruthy()
		// @ts-ignore
		expect(ExpectedMediaItems._isMock).toBeTruthy()
		// @ts-ignore
		expect(ExternalMessageQueue._isMock).toBeTruthy()
		// @ts-ignore
		expect(IngestDataCache._isMock).toBeTruthy()
		// @ts-ignore
		expect(MediaObjects._isMock).toBeTruthy()
		// @ts-ignore
		expect(MediaWorkFlows._isMock).toBeTruthy()
		// @ts-ignore
		expect(MediaWorkFlowSteps._isMock).toBeTruthy()
		// @ts-ignore
		expect(Parts._isMock).toBeTruthy()
		// @ts-ignore
		expect(PeripheralDeviceCommands._isMock).toBeTruthy()
		// @ts-ignore
		expect(PeripheralDevices._isMock).toBeTruthy()
		// @ts-ignore
		expect(Pieces._isMock).toBeTruthy()
		// @ts-ignore
		expect(RundownBaselineAdLibPieces._isMock).toBeTruthy()
		// @ts-ignore
		expect(RundownBaselineObjs._isMock).toBeTruthy()
		// @ts-ignore
		expect(Rundowns._isMock).toBeTruthy()
		// @ts-ignore
		expect(Segments._isMock).toBeTruthy()
		// @ts-ignore
		expect(ShowStyleBases._isMock).toBeTruthy()
		// @ts-ignore
		expect(ShowStyleVariants._isMock).toBeTruthy()
		// @ts-ignore
		expect(Snapshots._isMock).toBeTruthy()
		// @ts-ignore
		expect(Studios._isMock).toBeTruthy()
		// @ts-ignore
		expect(Timeline._isMock).toBeTruthy()
		// @ts-ignore
		expect(UserActionsLog._isMock).toBeTruthy()
	})
	test('Mock collection data', async () => {
		expect(await Studios.findFetchAsync({})).toHaveLength(0)

		MongoMock.mockSetData<DBStudio>(Studios, [
			{
				...defaultStudio(protectString('abc')),
				name: 'abc',
				_rundownVersionHash: 'abc',
			},
			{
				...defaultStudio(protectString('def')),
				name: 'def',
				_rundownVersionHash: 'def',
			},
		])

		expect(await Studios.findFetchAsync({})).toHaveLength(2)

		expect(
			await Studios.findOneAsync({
				_id: protectString('def'),
			})
		).toMatchObject({
			_id: 'def',
		})
		await Studios.updateAsync(protectString('abc'), {
			$set: {
				_rundownVersionHash: 'myHash',
			},
		})

		expect(
			await Studios.findOneAsync({
				name: 'abc',
			})
		).toMatchObject({
			_rundownVersionHash: 'myHash',
		})

		await Studios.removeAsync(protectString('def'))
		const studios = await Studios.findFetchAsync({})
		expect(studios).toHaveLength(1)

		const observer = Studios.observeChanges({ _id: protectString('abc') }, {})
		expect(observer).toBeTruthy()

		await Studios.insertAsync({
			...defaultStudio(protectString('xyz')),
			name: 'xyz',
			_rundownVersionHash: 'xyz',
		})
		expect(await Studios.findFetchAsync({})).toHaveLength(2)

		observer.stop()

		MongoMock.mockSetData(Studios, null)
		expect(await Studios.findFetchAsync({})).toHaveLength(0)
	})
	testInFiber('Promises in fibers', () => {
		const p = new Promise((resolve) => {
			setTimeout(() => {
				resolve('yup')
			}, 10)
		})

		const result = waitForPromise(p)

		expect(result).toEqual('yup')
	})
	testInFiber('Mongo mock', () => {
		const mockAdded = jest.fn()
		const mockChanged = jest.fn()
		const mockRemoved = jest.fn()

		const collection = new Mongo.Collection<any>('testmock')

		collection
			.find({
				prop: 'b',
			})
			.observeChanges({
				added: mockAdded,
				changed: mockChanged,
				removed: mockRemoved,
			})

		expect(collection.find({}).fetch()).toHaveLength(0)

		const id = collection.insert({ prop: 'a' })
		expect(id).toBeTruthy()
		expect(collection.find({}).fetch()).toHaveLength(1)
		expect(collection.findOne(id)).toMatchObject({
			prop: 'a',
		})
		expect(collection.remove(id)).toEqual(1)
		expect(collection.find({}).fetch()).toHaveLength(0)

		expect(mockAdded).toHaveBeenCalledTimes(0)
		expect(mockChanged).toHaveBeenCalledTimes(0)
		expect(mockRemoved).toHaveBeenCalledTimes(0)

		const id2 = collection.insert({ prop: 'b' })
		waitTime(10)
		expect(mockAdded).toHaveBeenCalledTimes(1)
		expect(mockChanged).toHaveBeenCalledTimes(0)
		expect(mockRemoved).toHaveBeenCalledTimes(0)
		mockAdded.mockClear()

		collection.update(id2, { $set: { name: 'test' } })
		waitTime(10)
		expect(mockAdded).toHaveBeenCalledTimes(0)
		expect(mockChanged).toHaveBeenCalledTimes(1)
		expect(mockRemoved).toHaveBeenCalledTimes(0)
		mockChanged.mockClear()

		collection.remove(id2)
		waitTime(10)
		expect(mockAdded).toHaveBeenCalledTimes(0)
		expect(mockChanged).toHaveBeenCalledTimes(0)
		expect(mockRemoved).toHaveBeenCalledTimes(1)
	})
})

function asynchronousFibersFunction(a: number, b: number, c: number): number {
	return innerAsynchronousFiberFunction(a, b) + c
}

const innerAsynchronousFiberFunction = Meteor.wrapAsync((val0, val1, cb) => {
	setTimeout(() => {
		cb(undefined, val0 + val1)
	}, 10)
})

function tempTestRandom() {
	return getRandomString()
}
