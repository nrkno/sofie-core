/**
 * This is an object which allows for overrides to be tracked and reapplied
 * Note: it does not yet support arrays. When one is encountered, that will be treated as a single 'value'
 */
export interface ObjectWithOverrides<T extends object> {
	defaults: T
	overrides: SomeObjectOverrideOp[]
}

/**
 * These ops are inspired by jsonpatch, but are intentionally not identical
 * We are not using jsonpatch as it will not handle applying a diff onto a different base object, but we need to
 */
export type SomeObjectOverrideOp = ObjectOverrideSetOp | ObjectOverrideDeleteOp

export interface ObjectOverrideSetOp {
	op: 'set'
	path: string
	value: any
}
export interface ObjectOverrideDeleteOp {
	op: 'delete'
	path: string
}

// export function diffObjects<T extends object>(base: T, overriden: T): ObjectWithOverrides<T> {
// 	// TODO
// }

export interface ApplyOverridesResult<T> {
	obj: T
	/** Overrides which should be preserved */
	preserve: SomeObjectOverrideOp[]
	/** Overrides which have no effect (also added to 'preserve') */
	unused: SomeObjectOverrideOp[]
	/** Overrides which do not map onto the current object shape */
	invalid: SomeObjectOverrideOp[]
}

export function applyAndValidateOverrides<T extends object>(_obj: ObjectWithOverrides<T>): ApplyOverridesResult<T> {
	// TODO
	throw new Error('not implemented')
}
