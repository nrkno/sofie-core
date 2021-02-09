import { StudioId } from '../../../lib/collections/Studios'
import { waitForPromise } from '../../../lib/lib'
import { syncFunction } from '../../codeControl'
import { CacheForStudio } from './cache'

/**
 * Lock the studio and load a cache of data about the studio
 * @param context Contextual information for the call to this function. to aid debugging
 * @param studioId Id of the studio to lock
 * @param fcn Function to run while holding the lock
 */
export function studioLockWithCacheFunction<T>(
	context: string,
	studioId: StudioId,
	fcn: (cache: CacheForStudio) => Promise<T> | T
): T {
	return studioLockFunction(context, studioId, async () => {
		const cache = await CacheForStudio.create(studioId)

		const res = await fcn(cache)

		await cache.saveAllToDatabase()

		return res
	})
}

/**
 * Lock the studio
 * @param context Contextual information for the call to this function. to aid debugging
 * @param studioId Id of the studio to lock
 * @param fcn Function to run while holding the lock
 */
export function studioLockFunction<T>(context: string, studioId: StudioId, fcn: () => Promise<T> | T): T {
	return syncFunction(
		() => {
			return waitForPromise(fcn())
		},
		context,
		`studio_${studioId}`
	)()
}
