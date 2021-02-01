import { testInFiber } from '../../../__mocks__/helpers/jest'
import { setupDefaultStudioEnvironment } from '../../../__mocks__/helpers/database'
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
	testInFiber('skip', () => {
		// TODO-CACHE
	})
	// describe('CacheForStudio', () => {
	// 	testInFiber('Assert no changes', async () => {
	// 		const studio = Studios.findOne() as Studio
	// 		expect(studio).toBeTruthy()

	// 		const added = jest.fn()
	// 		const changed = jest.fn()
	// 		const removed = jest.fn()
	// 		RundownPlaylists.find().observeChanges({
	// 			added,
	// 			changed,
	// 			removed,
	// 		})

	// 		{
	// 			const cache = await initCacheForStudio(studio._id)

	// 			const cachedStudio = cache.Studios.findOne(studio._id)
	// 			expect(cachedStudio).toMatchObject(studio)

	// 			cache.assertNoChanges() // this shouldn't throw
	// 			expect(true).toBeTruthy()
	// 		}

	// 		{
	// 			const cache = await initCacheForStudio(studio._id)
	// 			const id: RundownPlaylistId = protectString('myPlaylist0')

	// 			// Insert a document:
	// 			cache.RundownPlaylists.insert({
	// 				...defaultRundownPlaylist(id, studio._id, getRandomId()),
	// 				name: 'insert',
	// 			})
	// 			cache.RundownPlaylists.update(id, { $set: { name: 'insertthenupdate' } })

	// 			expect(cache.RundownPlaylists.findOne(id)).toBeTruthy()
	// 			expect(RundownPlaylists.findOne(id)).toBeFalsy()

	// 			expect(() => {
	// 				cache.assertNoChanges()
	// 			}).toThrowError(/failed .+ assertion,.+ was modified/gi)
	// 		}

	// 		{
	// 			const cache = await initCacheForStudio(studio._id)

	// 			// Insert a document:
	// 			cache.defer(() => {})

	// 			expect(() => {
	// 				cache.assertNoChanges()
	// 			}).toThrowError(/failed .+ assertion,.+ deferred/gi)
	// 		}

	// 		{
	// 			const cache = await initCacheForStudio(studio._id)

	// 			// Insert a document:
	// 			cache.deferAfterSave(() => {})

	// 			expect(() => {
	// 				cache.assertNoChanges()
	// 			}).toThrowError(/failed .+ assertion,.+ after-save deferred/gi)
	// 		}
	// 	})
	// })
})
