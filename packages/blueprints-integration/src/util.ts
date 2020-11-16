import * as _ from 'underscore'
// tslint:disable-next-line:no-submodule-imports
import * as tsrPkgInfo from 'timeline-state-resolver-types/package.json'

/** @deprecated This is temporary and should be removed ASAP. Can we do it better? */
export const TMP_TSR_VERSION: string = tsrPkgInfo.version

export enum iterateDeeplyEnum {
	CONTINUE = '$continue',
}

/**
 * Iterates deeply through object or array
 * @param obj the object or array to iterate through
 * @param iteratee function to apply on every attribute
 */
export function iterateDeeply(
	obj: any,
	iteratee: (val: any, key?: string | number) => any | iterateDeeplyEnum,
	key?: string | number
) {
	const newValue = iteratee(obj, key)
	if (newValue === iterateDeeplyEnum.CONTINUE) {
		// Continue iterate deeper if possible
		if (_.isObject(obj)) {
			// object or array
			_.each(obj, (v, k) => {
				obj[k] = iterateDeeply(v, iteratee, k)
			})
		} else {
			// don't change anything
		}
		return obj
	} else {
		return newValue
	}
}
/**
 * Iterates deeply through object or array, using an asynchronous iteratee
 * @param obj the object or array to iterate through
 * @param iteratee function to apply on every attribute
 */
export async function iterateDeeplyAsync(
	obj: any,
	iteratee: (val: any, key?: string | number) => Promise<any | iterateDeeplyEnum>,
	key?: string | number
) {
	const newValue = await iteratee(obj, key)
	if (newValue === iterateDeeplyEnum.CONTINUE) {
		// Continue iterate deeper if possible
		if (_.isObject(obj)) {
			// object or array
			await Promise.all(
				_.map(obj, async (v, k) => {
					obj[k] = await iterateDeeplyAsync(v, iteratee, k)
				})
			)
		} else {
			// don't change anything
		}
		return obj
	} else {
		return newValue
	}
}
