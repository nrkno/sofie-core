import { StudioId } from '../../../lib/collections/Studios'
import { waitForPromise } from '../../../lib/lib'
import { ReadOnlyCache } from '../../cache/DatabaseCaches'
import { syncFunction } from '../../codeControl'
import { CacheForStudio, CacheForStudioBase } from './cache'

export interface StudioLock {
	readonly _studioId: StudioId
}

export function isStudioLock(obj: any): obj is StudioLock {
	const obj0 = obj as StudioLock
	return !!obj0._studioId
}

export function getStudioIdFromCacheOrLock(
	cacheOrLock: StudioLock | Pick<ReadOnlyCache<CacheForStudio>, 'Studio'>
): StudioId {
	if (isStudioLock(cacheOrLock)) {
		return cacheOrLock._studioId
	} else {
		return cacheOrLock.Studio.doc._id
	}
}

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
export function studioLockFunction<T>(
	context: string,
	studioId: StudioId,
	fcn: (lock: StudioLock) => Promise<T> | T
): T {
	return syncFunction(() => waitForPromise(fcn({ _studioId: studioId })), context, `studio_${studioId}`)()
}
