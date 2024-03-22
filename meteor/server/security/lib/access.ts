import * as _ from 'underscore'

export interface Access<T> {
	// Direct database access:
	read: boolean
	insert: boolean
	update: boolean
	remove: boolean

	// Methods access:
	playout: boolean
	configure: boolean

	// For debugging
	reason: string

	// The document in question
	document: T | null
}

/**
 * Grant all access to all of the document
 * @param document The document
 * @param reason The reason for the access being granted
 */
export function allAccess<T>(document: T | null, reason?: string): Access<T> {
	return {
		read: true,
		insert: true,
		update: true,
		remove: true,

		playout: true,
		configure: true,
		reason: reason || '',
		document: document,
	}
}

/**
 * Deny all access to all of the document
 * @param reason The reason for the access being denied
 */
export function noAccess(reason: string): Access<any> {
	return combineAccess({}, allAccess(null, reason))
}

/**
 * Combine access objects to find the minimum common overlap
 * @param access0
 * @param access1
 */
export function combineAccess<T>(
	access0: Access<T> | { reason?: string; document?: null },
	access1: Access<T>
): Access<T> {
	const a: any = {}
	_.each(_.keys(access0).concat(_.keys(access1)), (key) => {
		a[key] = (access0 as any)[key] && (access1 as any)[key]
	})
	a.reason = _.compact([access0.reason, access1.reason]).join(',')
	a.document = access0.document || access1.document || null
	return a
}
