import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { TimelineComplete } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { sleep } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { CacheForStudio } from '../../studio/cache'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context'

describe('DatabaseCaches', () => {
	let context: MockJobContext
	beforeEach(async () => {
		context = setupDefaultJobEnvironment()

		// setLogLevel(LogLevel.INFO)
	})
	describe('CacheForStudio', () => {
		test('Insert, update & remove', async () => {
			const bulkWrite = jest.spyOn(context.directCollections.Timelines, 'bulkWrite')

			let dbObj: TimelineComplete | undefined
			const cache = await CacheForStudio.create(context)

			const id: StudioId = protectString('tewtDoc1')

			// Insert a document:
			cache.Timeline.insert({
				_id: id,
				timelineBlob: protectString(''),
				timelineHash: protectString('insert'),
				generationVersions: {
					core: '',
					blueprintId: protectString(''),
					blueprintVersion: '',
					studio: '',
				},
				generated: 1234,
			})
			cache.Timeline.update(id, { $set: { timelineHash: protectString('insertthenupdate') } })

			expect(cache.Timeline.findOne(id)).toBeTruthy()
			await expect(context.directCollections.Timelines.findOne(id)).resolves.toBeFalsy()

			await sleep(1) // to allow for observers to trigger
			expect(bulkWrite).toHaveBeenCalledTimes(0)

			await cache.saveAllToDatabase()
			await sleep(1) // to allow for observers to trigger
			{
				expect(bulkWrite).toHaveBeenCalledTimes(1)
				const ops = bulkWrite.mock.calls[0][0]
				expect(ops).toHaveLength(1)
				expect(ops[0]).toMatchObject({
					replaceOne: {
						filter: {
							_id: id,
						},
						replacement: {
							_id: id,
							timelineHash: 'insertthenupdate',
						},
						upsert: true,
					},
				})
			}

			bulkWrite.mockClear()
			dbObj = await context.directCollections.Timelines.findOne(id)
			expect(dbObj).toMatchObject({ timelineHash: 'insertthenupdate' })

			// Update a document:
			cache.Timeline.update(
				{
					timelineHash: protectString('insertthenupdate'),
				},
				{ $set: { timelineHash: protectString('updated') } }
			)

			await cache.saveAllToDatabase()

			await sleep(1) // to allow for observers to trigger
			{
				expect(bulkWrite).toHaveBeenCalledTimes(1)
				const ops = bulkWrite.mock.calls[0][0]
				expect(ops).toHaveLength(1)
				expect(ops[0]).toMatchObject({
					replaceOne: {
						filter: {
							_id: id,
						},
						replacement: {
							_id: id,
							timelineHash: 'updated',
						},
					},
				})
			}

			bulkWrite.mockClear()
			dbObj = await context.directCollections.Timelines.findOne(id)
			expect(dbObj).toMatchObject({ timelineHash: 'updated' })

			// Remove a document:
			cache.Timeline.remove(id)

			await cache.saveAllToDatabase()
			await sleep(1) // to allow for observers to trigger
			{
				expect(bulkWrite).toHaveBeenCalledTimes(1)
				const ops = bulkWrite.mock.calls[0][0]
				expect(ops).toHaveLength(1)
				expect(ops[0]).toMatchObject({
					deleteMany: {
						filter: {
							_id: { $in: [id] },
						},
					},
				})
			}

			bulkWrite.mockClear()
			await expect(context.directCollections.Timelines.findOne(id)).resolves.toBeFalsy()
		})
		test('Multiple saves', async () => {
			const bulkWrite = jest.spyOn(context.directCollections.Timelines, 'bulkWrite')

			const cache = await CacheForStudio.create(context)

			const id: StudioId = protectString('tewtDoc1')

			// Insert a document:
			cache.Timeline.insert({
				_id: id,
				timelineBlob: protectString(''),
				timelineHash: protectString('insert'),
				generationVersions: {
					core: '',
					blueprintId: protectString(''),
					blueprintVersion: '',
					studio: '',
				},
				generated: 1234,
			})
			const deferFcn0 = jest.fn(async () => {
				await expect(context.directCollections.Timelines.findOne(id)).resolves.toBeFalsy()
			})
			const deferAfterSaveFcn0 = jest.fn(async () => {
				await expect(context.directCollections.Timelines.findOne(id)).resolves.toBeTruthy()
			})
			cache.defer(deferFcn0)
			cache.deferAfterSave(deferAfterSaveFcn0)

			await expect(context.directCollections.Timelines.findOne(id)).resolves.toBeFalsy()
			await cache.saveAllToDatabase()
			await sleep(1) // to allow for observers to trigger
			{
				expect(bulkWrite).toHaveBeenCalledTimes(1)
				const ops = bulkWrite.mock.calls[0][0]
				expect(ops).toHaveLength(1)
				expect(ops[0]).toMatchObject({
					replaceOne: {
						filter: {
							_id: id,
						},
						replacement: {
							_id: id,
							timelineHash: 'insert',
						},
						upsert: true,
					},
				})
			}
			await expect(context.directCollections.Timelines.findOne(id)).resolves.toBeTruthy()
			expect(deferFcn0).toHaveReturnedTimes(1)
			expect(deferAfterSaveFcn0).toHaveReturnedTimes(1)
			bulkWrite.mockClear()
			deferFcn0.mockClear()
			deferAfterSaveFcn0.mockClear()

			// Running the save again should render no changes:
			await cache.saveAllToDatabase()
			await sleep(1) // to allow for observers to trigger
			expect(bulkWrite).toHaveBeenCalledTimes(0)
			expect(deferFcn0).toHaveReturnedTimes(0)
			expect(deferAfterSaveFcn0).toHaveReturnedTimes(0)

			// Update the document:
			cache.Timeline.update(id, { $set: { timelineHash: protectString('updated') } })
			// add new defered functions:
			const deferFcn1 = jest.fn(async () => {
				await expect(context.directCollections.Timelines.findOne(id)).resolves.toMatchObject({
					timelineHash: protectString('insert'),
				})
			})
			const deferAfterSaveFcn1 = jest.fn(async () => {
				await expect(context.directCollections.Timelines.findOne(id)).resolves.toMatchObject({
					timelineHash: protectString('updated'),
				})
			})
			cache.defer(deferFcn1)
			cache.deferAfterSave(deferAfterSaveFcn1)

			await cache.saveAllToDatabase()
			await sleep(1) // to allow for observers to trigger
			{
				expect(bulkWrite).toHaveBeenCalledTimes(1)
				const ops = bulkWrite.mock.calls[0][0]
				expect(ops).toHaveLength(1)
				expect(ops[0]).toMatchObject({
					replaceOne: {
						filter: {
							_id: id,
						},
						replacement: {
							_id: id,
							timelineHash: 'updated',
						},
					},
				})
			}
			expect(deferFcn0).toHaveReturnedTimes(0)
			expect(deferAfterSaveFcn0).toHaveReturnedTimes(0)
			expect(deferFcn1).toHaveReturnedTimes(1)
			expect(deferAfterSaveFcn1).toHaveReturnedTimes(1)
			bulkWrite.mockClear()
			deferFcn1.mockClear()
			deferAfterSaveFcn1.mockClear()

			// Remove the document:
			cache.Timeline.remove(id)

			await cache.saveAllToDatabase()
			await sleep(1) // to allow for observers to trigger
			{
				expect(bulkWrite).toHaveBeenCalledTimes(1)
				const ops = bulkWrite.mock.calls[0][0]
				expect(ops).toHaveLength(1)
				expect(ops[0]).toMatchObject({
					deleteMany: {
						filter: {
							_id: { $in: [id] },
						},
					},
				})
			}
			expect(deferFcn0).toHaveReturnedTimes(0)
			expect(deferAfterSaveFcn0).toHaveReturnedTimes(0)
			expect(deferFcn1).toHaveReturnedTimes(0)
			expect(deferAfterSaveFcn1).toHaveReturnedTimes(0)
		})

		test('Assert no changes', async () => {
			{
				const cache = await CacheForStudio.create(context)
				const id: StudioId = protectString('myPlaylist0')

				// Insert a document:
				cache.Timeline.insert({
					_id: id,
					timelineBlob: protectString(''),
					timelineHash: protectString('insert'),
					generationVersions: {
						core: '',
						blueprintId: protectString(''),
						blueprintVersion: '',
						studio: '',
					},
					generated: 1234,
				})
				cache.Timeline.update(id, { $set: { timelineHash: protectString('insertthenupdate') } })

				expect(cache.Timeline.findOne(id)).toBeTruthy()
				await expect(context.directCollections.Timelines.findOne(id)).resolves.toBeFalsy()

				expect(() => {
					cache.assertNoChanges()
				}).toThrowError(/failed .+ assertion,.+ was modified/gi)
			}

			{
				const cache = await CacheForStudio.create(context)

				// Insert a document:
				cache.defer(() => {
					//
				})

				expect(() => {
					cache.assertNoChanges()
				}).toThrowError(/failed .+ assertion,.+ deferred/gi)
			}

			{
				const cache = await CacheForStudio.create(context)

				// Insert a document:
				cache.deferAfterSave(() => {
					//
				})

				expect(() => {
					cache.assertNoChanges()
				}).toThrowError(/failed .+ assertion,.+ after-save deferred/gi)
			}
		})
	})
})
