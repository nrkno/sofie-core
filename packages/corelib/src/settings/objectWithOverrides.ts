import objectPath = require('object-path')
import _ = require('underscore')
import { assertNever, clone } from '../lib'

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

export interface ApplyOverridesResult<T extends object> {
	obj: T
	/** Overrides which should be preserved */
	preserve: SomeObjectOverrideOp[]
	/** Overrides which have no effect (also added to 'preserve') */
	unused: SomeObjectOverrideOp[]
	/** Overrides which do not map onto the current object shape */
	invalid: SomeObjectOverrideOp[]
}

function getParentObjectPath(path: string): string | undefined {
	const lastIndex = path.lastIndexOf('.')
	if (lastIndex === -1) return undefined

	return path.substring(0, lastIndex)
}

/**
 * Combine the ObjectWithOverrides to give the simplified object.
 * Also performs validation of the overrides, and classifies them
 * Note: No validation is done to make sure the type conforms to the typescript definition. It is assumed that the definitions which drive ui ensure that they dont violate the typings, and that any changes will be backwards compatible with old overrides
 */
export function applyAndValidateOverrides<T extends object>(obj: ObjectWithOverrides<T>): ApplyOverridesResult<T> {
	const result: ApplyOverridesResult<T> = {
		obj: clone(obj.defaults),
		preserve: [],
		unused: [],
		invalid: [],
	}

	// Work through all the overrides
	for (const override of obj.overrides) {
		switch (override.op) {
			case 'set':
				applySetOp(result, override)
				break
			case 'delete':
				applyDeleteOp(result, override)
				break
			default:
				assertNever(override)
				result.invalid.push(override)
				break
		}
	}

	return result
}

function applySetOp<T extends object>(result: ApplyOverridesResult<T>, operation: ObjectOverrideSetOp): void {
	const parentPath = getParentObjectPath(operation.path)
	if (parentPath && !objectPath.has(result.obj, parentPath)) {
		// Parent does not exist in the object, so this is invalid
		result.invalid.push(operation)
	} else {
		result.preserve.push(operation)

		const existingValue = objectPath.get(result.obj, operation.path)
		if (_.isEqual(existingValue, operation.value)) {
			// Same value
			result.unused.push(operation)
		} else {
			// Set the new value
			objectPath.set(result.obj, operation.path, clone(operation.value))
		}
	}
}

function applyDeleteOp<T extends object>(result: ApplyOverridesResult<T>, operation: ObjectOverrideDeleteOp): void {
	if (objectPath.has(result.obj, operation.path)) {
		// It exists in the path, so do the delete
		objectPath.del(result.obj, operation.path)
	} else {
		// Track that the op did nothing
		result.unused.push(operation)
	}
	// Always keep the delete op
	result.preserve.push(operation)
}
