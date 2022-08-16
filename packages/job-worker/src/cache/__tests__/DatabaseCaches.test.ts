import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { sleep } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { getRundownId } from '../../ingest/lib'
import { CacheForIngest } from '../../ingest/cache'
import { CacheForStudio } from '../../studio/cache'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context'

describe('DatabaseCaches', () => {
	let context: MockJobContext
	beforeEach(async () => {
		context = setupDefaultJobEnvironment()

		// setLogLevel(LogLevel.INFO)
	})
	describe('CacheForIngest', () => {
		test('Insert, update & remove', async () => {
			const bulkWrite = jest.spyOn(context.directCollections.Parts, 'bulkWrite')

			let dbObj: DBPart | undefined
			const lock = await context.lockRundown(getRundownId(context.studioId, 'testRundown'))
			try {
				const cache = await CacheForIngest.create(context, lock, 'testRundown')

				const id: PartId = protectString('tewtDoc1')

				// Insert a document:
				cache.Parts.insert({
					_id: id,
					_rank: 1,
					title: 'Test',
					rundownId: protectString(''),
					segmentId: protectString(''),
					externalId: 'test',
					expectedDurationWithPreroll: undefined,
				})
				cache.Parts.update(id, { $set: { title: 'Test2' } })

				expect(cache.Parts.findOne(id)).toBeTruthy()
				await expect(context.directCollections.Parts.findOne(id)).resolves.toBeFalsy()

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
								title: 'Test2',
							},
							upsert: true,
						},
					})
				}

				bulkWrite.mockClear()
				dbObj = await context.directCollections.Parts.findOne(id)
				expect(dbObj).toMatchObject({ title: 'Test2' })

				// Update a document:
				cache.Parts.update(
					{
						title: 'Test2',
					},
					{ $set: { title: 'Test4' } }
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
								title: 'Test4',
							},
						},
					})
				}

				bulkWrite.mockClear()
				dbObj = await context.directCollections.Parts.findOne(id)
				expect(dbObj).toMatchObject({ title: 'Test4' })

				// Remove a document:
				cache.Parts.remove(id)

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
				await expect(context.directCollections.Parts.findOne(id)).resolves.toBeFalsy()
			} finally {
				await lock.release()
			}
		})
		test('Multiple saves', async () => {
			const bulkWrite = jest.spyOn(context.directCollections.Parts, 'bulkWrite')

			const lock = await context.lockRundown(getRundownId(context.studioId, 'testRundown'))
			try {
				const cache = await CacheForIngest.create(context, lock, 'testRundown')

				const id: PartId = protectString('tewtDoc1')

				// Insert a document:
				cache.Parts.insert({
					_id: id,
					_rank: 1,
					title: 'Test',
					rundownId: protectString(''),
					segmentId: protectString(''),
					externalId: 'test',
					expectedDurationWithPreroll: undefined,
				})
				const deferFcn0 = jest.fn(async () => {
					await expect(context.directCollections.Parts.findOne(id)).resolves.toBeFalsy()
				})
				const deferAfterSaveFcn0 = jest.fn(async () => {
					await expect(context.directCollections.Parts.findOne(id)).resolves.toBeTruthy()
				})
				cache.defer(deferFcn0)
				cache.deferAfterSave(deferAfterSaveFcn0)

				await expect(context.directCollections.Parts.findOne(id)).resolves.toBeFalsy()
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
								title: 'Test',
							},
							upsert: true,
						},
					})
				}
				await expect(context.directCollections.Parts.findOne(id)).resolves.toBeTruthy()
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
				cache.Parts.update(id, { $set: { title: 'updated' } })
				// add new defered functions:
				const deferFcn1 = jest.fn(async () => {
					await expect(context.directCollections.Parts.findOne(id)).resolves.toMatchObject({
						title: protectString('Test'),
					})
				})
				const deferAfterSaveFcn1 = jest.fn(async () => {
					await expect(context.directCollections.Parts.findOne(id)).resolves.toMatchObject({
						title: 'updated',
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
								title: 'updated',
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
				cache.Parts.remove(id)

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
			} finally {
				await lock.release()
			}
		})

		test('Assert no changes', async () => {
			const lock = await context.lockRundown(getRundownId(context.studioId, 'testRundown'))
			try {
				{
					const cache = await CacheForIngest.create(context, lock, 'testRundown')

					const id: PartId = protectString('myPlaylist0')

					// Insert a document:
					cache.Parts.insert({
						_id: id,
						_rank: 1,
						title: 'Test',
						rundownId: protectString(''),
						segmentId: protectString(''),
						externalId: 'test',
						expectedDurationWithPreroll: undefined,
					})
					cache.Parts.update(id, { $set: { title: 'insertthenupdate' } })

					expect(cache.Parts.findOne(id)).toBeTruthy()
					await expect(context.directCollections.Parts.findOne(id)).resolves.toBeFalsy()

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
			} finally {
				await lock.release()
			}
		})
	})
})
