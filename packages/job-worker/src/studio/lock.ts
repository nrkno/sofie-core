import { JobContext } from '../jobs'
import { StudioPlayoutModel } from './StudioPlayoutModel'
import { loadStudioPlayoutModel } from './StudioPlayoutModelImpl'

/**
 * Run a typical studio job
 * This means loading the studio cache, doing some calculations and saving the result
 */
export async function runJobWithStudioCache<TRes>(
	context: JobContext,
	fcn: (cache: StudioPlayoutModel) => Promise<TRes>
): Promise<TRes> {
	const cache = await loadStudioPlayoutModel(context)

	try {
		const res = await fcn(cache)

		await cache.saveAllToDatabase()

		return res
	} catch (err) {
		cache.dispose()
		throw err
	}
}
