import { testInFiber } from '../../../__mocks__/helpers/jest'
import { setupDefaultStudioEnvironment } from '../../../__mocks__/helpers/database'
import { initCacheForStudioBase } from '../../DatabaseCaches'
import { Studios, Studio } from '../../../lib/collections/Studios'
import { getRandomId, waitTime, protectString } from '../../../lib/lib'
import { RundownPlaylistId, RundownPlaylists, RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { defaultRundownPlaylist } from '../../../__mocks__/defaultCollectionObjects'

// setLoggerLevel('info')

const orgSetTimeout = setTimeout

describe('DatabaseCaches', () => {
	beforeEach(() => {
		setupDefaultStudioEnvironment()
	})
	describe('CacheForStudioBase', () => {
		testInFiber('Insert, update & remove', async () => {
			const studio = Studios.findOne() as Studio
			expect(studio).toBeTruthy()

			const added = jest.fn()
			const changed = jest.fn()
			const removed = jest.fn()
			RundownPlaylists.find().observeChanges({
				added,
				changed,
				removed,
			})

			let dbObj: RundownPlaylist | undefined
			// const cache = new CacheForStudioBase()
			const cache = await initCacheForStudioBase(studio._id)

			const id: RundownPlaylistId = protectString('myPlaylist0')

			// Insert a document:
			cache.RundownPlaylists.insert({
				...defaultRundownPlaylist(id, studio._id, getRandomId()),
				name: 'insert',
			})
			cache.RundownPlaylists.update(id, { $set: { name: 'insertthenupdate' } })

			expect(cache.RundownPlaylists.findOne(id)).toBeTruthy()
			expect(RundownPlaylists.findOne(id)).toBeFalsy()

			waitTime(1) // to allow for observers to trigger
			expect(added).toHaveBeenCalledTimes(0)
			expect(changed).toHaveBeenCalledTimes(0)
			expect(removed).toHaveBeenCalledTimes(0)

			await cache.saveAllToDatabase()
			waitTime(1) // to allow for observers to trigger
			expect(added).toHaveBeenCalledTimes(1)
			expect(changed).toHaveBeenCalledTimes(0) // the previous update should have been included in the insert
			expect(removed).toHaveBeenCalledTimes(0)
			added.mockClear()
			dbObj = RundownPlaylists.findOne(id)
			expect(dbObj).toMatchObject({ name: 'insertthenupdate' })

			// Update a document:
			cache.RundownPlaylists.update(
				{
					name: 'insertthenupdate',
				},
				{ $set: { name: 'updated' } }
			)

			await cache.saveAllToDatabase()

			waitTime(1) // to allow for observers to trigger
			expect(added).toHaveBeenCalledTimes(0)
			expect(changed).toHaveBeenCalledTimes(1)
			expect(removed).toHaveBeenCalledTimes(0)
			changed.mockClear()
			dbObj = RundownPlaylists.findOne(id)
			expect(dbObj).toMatchObject({ name: 'updated' })

			// Remove a document:
			cache.RundownPlaylists.remove(id)

			await cache.saveAllToDatabase()
			waitTime(1) // to allow for observers to trigger
			expect(added).toHaveBeenCalledTimes(0)
			expect(changed).toHaveBeenCalledTimes(0)
			expect(removed).toHaveBeenCalledTimes(1)
			removed.mockClear()
			expect(RundownPlaylists.findOne(id)).toBeFalsy()
		})
		testInFiber('Multiple saves', async () => {
			const studio = Studios.findOne() as Studio
			expect(studio).toBeTruthy()

			const added = jest.fn()
			const changed = jest.fn()
			const removed = jest.fn()
			RundownPlaylists.find().observeChanges({
				added,
				changed,
				removed,
			})

			let dbObj: RundownPlaylist | undefined
			// const cache = new CacheForStudioBase()
			const cache = await initCacheForStudioBase(studio._id)

			const id: RundownPlaylistId = protectString('myPlaylist1')

			// Insert a document:
			cache.RundownPlaylists.insert({
				...defaultRundownPlaylist(id, studio._id, getRandomId()),
				name: 'insert',
			})
			const deferFcn0 = jest.fn(() => {
				expect(RundownPlaylists.findOne(id)).toBeFalsy()
			})
			const deferAfterSaveFcn0 = jest.fn(() => {
				expect(RundownPlaylists.findOne(id)).toBeTruthy()
			})
			cache.defer(deferFcn0)
			cache.deferAfterSave(deferAfterSaveFcn0)

			expect(RundownPlaylists.findOne(id)).toBeFalsy()
			await cache.saveAllToDatabase()
			waitTime(1) // to allow for observers to trigger
			expect(added).toHaveBeenCalledTimes(1)
			expect(changed).toHaveBeenCalledTimes(0)
			expect(removed).toHaveBeenCalledTimes(0)
			expect(RundownPlaylists.findOne(id)).toBeTruthy()
			expect(deferFcn0).toHaveReturnedTimes(1)
			expect(deferAfterSaveFcn0).toHaveReturnedTimes(1)
			added.mockClear()
			deferFcn0.mockClear()
			deferAfterSaveFcn0.mockClear()

			// Running the save again should render no changes:
			await cache.saveAllToDatabase()
			waitTime(1) // to allow for observers to trigger
			expect(added).toHaveBeenCalledTimes(0)
			expect(changed).toHaveBeenCalledTimes(0)
			expect(removed).toHaveBeenCalledTimes(0)
			expect(deferFcn0).toHaveReturnedTimes(0)
			expect(deferAfterSaveFcn0).toHaveReturnedTimes(0)

			// Update the document:
			cache.RundownPlaylists.update(id, { $set: { name: 'updated' } })
			// add new defered functions:
			const deferFcn1 = jest.fn(() => {
				expect(RundownPlaylists.findOne(id)).toMatchObject({ name: 'insert' })
			})
			const deferAfterSaveFcn1 = jest.fn(() => {
				expect(RundownPlaylists.findOne(id)).toMatchObject({ name: 'updated' })
			})
			cache.defer(deferFcn1)
			cache.deferAfterSave(deferAfterSaveFcn1)

			await cache.saveAllToDatabase()
			waitTime(1) // to allow for observers to trigger
			expect(added).toHaveBeenCalledTimes(0)
			expect(changed).toHaveBeenCalledTimes(1)
			expect(removed).toHaveBeenCalledTimes(0)
			expect(deferFcn0).toHaveReturnedTimes(0)
			expect(deferAfterSaveFcn0).toHaveReturnedTimes(0)
			expect(deferFcn1).toHaveReturnedTimes(1)
			expect(deferAfterSaveFcn1).toHaveReturnedTimes(1)
			changed.mockClear()
			deferFcn1.mockClear()
			deferAfterSaveFcn1.mockClear()

			// Remove the document:
			cache.RundownPlaylists.remove(id)

			await cache.saveAllToDatabase()
			waitTime(1) // to allow for observers to trigger
			expect(added).toHaveBeenCalledTimes(0)
			expect(changed).toHaveBeenCalledTimes(0)
			expect(removed).toHaveBeenCalledTimes(1)
			expect(deferFcn0).toHaveReturnedTimes(0)
			expect(deferAfterSaveFcn0).toHaveReturnedTimes(0)
			expect(deferFcn1).toHaveReturnedTimes(0)
			expect(deferAfterSaveFcn1).toHaveReturnedTimes(0)
		})
	})
})
