import * as _ from 'underscore'

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
