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
export function noAccess(reason: string): Access<any> {
	return combineAccess({}, allAccess(null, reason))
}
export function combineAccess<T>(
	access0: Access<T> | { reason?: string; document?: null },
	access1: Access<T>
): Access<T> {
	const a: any = {}
	_.each(_.keys(access0).concat(_.keys(access1)), (key) => {
		a[key] = access0[key] && access1[key]
	})
	a.reason = _.compact([access0.reason, access1.reason]).join(',')
	a.document = access0.document || access1.document || null
	return a
}
