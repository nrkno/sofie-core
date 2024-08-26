import '../../../__mocks__/_extendJest'
import { TSR } from '@sofie-automation/blueprints-integration'
import {
	TimelineObjGeneric,
	TimelineObjType,
	TimelineComplete,
	deserializeTimelineBlob,
	serializeTimelineBlob,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { protectString } from '../tempLib'
import { testInFiber } from '../../../__mocks__/helpers/jest'
import { Timeline } from '../../collections'
import { SaveIntoDbHooks, saveIntoDb, sumChanges, anythingChanged } from '../database'
import { makePromise } from '../lib'
import { Meteor } from 'meteor/meteor'

describe('server/lib', () => {
	testInFiber('saveIntoDb', async () => {
		const mystudioObjs: Array<TimelineObjGeneric> = [
			{
				id: 'abc',
				enable: {
					start: 0,
				},
				layer: 'L1',
				content: { deviceType: TSR.DeviceType.ABSTRACT },
				objectType: TimelineObjType.RUNDOWN,
				classes: ['abc'], // to be removed
				priority: 0,
			},
			{
				id: 'abc2',
				enable: {
					start: 0,
				},
				layer: 'L1',
				content: { deviceType: TSR.DeviceType.ABSTRACT },
				objectType: TimelineObjType.RUNDOWN,
				priority: 0,
			},
		]
		await Timeline.mutableCollection.insertAsync({
			_id: protectString('myStudio'),
			timelineHash: protectString('abc'),
			generated: 1234,
			timelineBlob: serializeTimelineBlob(mystudioObjs),
			generationVersions: {} as any,
		})

		const mystudio2Objs: Array<TimelineObjGeneric> = [
			{
				id: 'abc10',
				enable: {
					start: 0,
				},
				layer: 'L1',
				content: { deviceType: TSR.DeviceType.ABSTRACT },
				objectType: TimelineObjType.RUNDOWN,
				priority: 0,
			},
		]
		await Timeline.mutableCollection.insertAsync({
			_id: protectString('myStudio2'),
			timelineHash: protectString('abc'),
			generated: 1234,
			timelineBlob: serializeTimelineBlob(mystudio2Objs),
			generationVersions: {} as any,
		})

		const options: SaveIntoDbHooks<any> = {
			beforeInsert: jest.fn((o) => o),
			beforeUpdate: jest.fn((o) => o),
			beforeRemove: jest.fn((o) => o),
			beforeDiff: jest.fn((o) => o),
			// insert: jest.fn((o) => o),
			// update: jest.fn((id, o,) => { return undefined }),
			// remove: jest.fn((o) => { return undefined }),
			afterInsert: jest.fn((_o) => {
				return undefined
			}),
			afterUpdate: jest.fn((_o) => {
				return undefined
			}),
			afterRemove: jest.fn((_o) => {
				return undefined
			}),
		}

		const changes = await saveIntoDb(
			Timeline.mutableCollection,
			{
				_id: protectString('myStudio'),
			},
			[
				{
					_id: protectString('myStudio'),
					timelineBlob: JSON.stringify([
						{
							id: 'abc',
							enable: {
								start: 0,
							},
							layer: 'L2', // changed property
							content: { deviceType: TSR.DeviceType.ABSTRACT },
							studioId: protectString('myStudio'),
						},
						{
							// insert object
							id: 'abc3',
							enable: {
								start: 0,
							},
							layer: 'L1',
							content: { deviceType: TSR.DeviceType.ABSTRACT },
							objectType: TimelineObjType.RUNDOWN,
						}, // remove abc2
					]),
				},
			],
			options
		)

		expect(
			await Timeline.countDocuments({
				_id: protectString('myStudio'),
			})
		).toEqual(1)
		const abc = (await Timeline.findOneAsync(protectString('myStudio'))) as TimelineComplete
		expect(abc).toBeTruthy()
		const timeline = deserializeTimelineBlob(abc.timelineBlob)
		expect(timeline).toHaveLength(2)
		expect(timeline[0].classes).toEqual(undefined)
		expect(timeline[0].layer).toEqual('L2')

		expect(
			await Timeline.countDocuments({
				_id: protectString('myStudio2'),
			})
		).toEqual(1)

		expect(options.beforeInsert).toHaveBeenCalledTimes(0) //- overwrites with single timeline object
		expect(options.beforeUpdate).toHaveBeenCalledTimes(1)
		expect(options.beforeRemove).toHaveBeenCalledTimes(0) // - overwrites with single timeline object
		expect(options.beforeDiff).toHaveBeenCalledTimes(1)
		expect(options.afterInsert).toHaveBeenCalledTimes(0)
		expect(options.afterUpdate).toHaveBeenCalledTimes(1)
		expect(options.afterRemove).toHaveBeenCalledTimes(0)

		expect(changes).toMatchObject({
			updated: 1,
		})
		expect(
			sumChanges(
				{
					added: 1,
					updated: 2,
					removed: 3,
				},
				changes
			)
		).toMatchObject({
			added: 1,
			updated: 3,
			removed: 3,
		})
	})
	testInFiber('anythingChanged', () => {
		expect(
			anythingChanged({
				added: 0,
				updated: 0,
				removed: 0,
			})
		).toBeFalsy()
		expect(
			anythingChanged({
				added: 1,
				updated: 0,
				removed: 0,
			})
		).toBeTruthy()
		expect(
			anythingChanged({
				added: 0,
				updated: 9,
				removed: 0,
			})
		).toBeTruthy()
		expect(
			anythingChanged({
				added: 0,
				updated: 0,
				removed: 547,
			})
		).toBeTruthy()
	})

	testInFiber('makePromise', async () => {
		let a = 0
		// Check that they are executed in order:
		expect(
			await Promise.all([
				makePromise(() => {
					return a++
				}),
				makePromise(() => {
					return a++
				}),
			])
		).toStrictEqual([0, 1])

		// Handle an instant throw:
		await expect(
			makePromise(() => {
				throw new Error('asdf')
			})
		).rejects.toMatchToString(/asdf/)

		// Handle a delayed throw:
		const delayedThrow = Meteor.wrapAsync((callback: (err: any, result: any) => void) => {
			setTimeout(() => {
				callback(new Error('asdf'), null)
			}, 10)
		})
		await expect(
			makePromise(() => {
				delayedThrow()
			})
		).rejects.toMatchToString(/asdf/)
	})
})
