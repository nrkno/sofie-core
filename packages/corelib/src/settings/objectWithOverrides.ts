import objectPath = require('object-path')
import { ReadonlyDeep } from 'type-fest'
import _ = require('underscore')
import { assertNever, clone, literal } from '../lib'

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

export function wrapDefaultObject<T extends object>(obj: T): ObjectWithOverrides<T> {
	return {
		defaults: obj,
		overrides: [],
	}
}
/**
 * In some cases, an ObjectWithOverrides should have no defaults. This is common for when the user owns the object containing the ObjectWithOverrides.
 * This helper takes an ObjectWithOverrides, and converts it to have no defaults, and have each contained object as an override
 */
export function convertObjectIntoOverrides<T>(
	rawObj: ReadonlyDeep<Record<string, T>> | undefined
): ObjectWithOverrides<Record<string, T>> {
	const result = wrapDefaultObject<Record<string, T>>({})

	if (rawObj) {
		for (const [id, obj] of Object.entries<ReadonlyDeep<T>>(rawObj)) {
			result.overrides.push(
				literal<ObjectOverrideSetOp>({
					op: 'set',
					path: id,
					value: obj,
				})
			)
		}
	}

	return result
}

/**
 * Update the ObjectWithOverrides overrides values from a flat object.
 * If there is an exiting override for a value update the override value if required.
 * Otherwise if the flat object value is different to the default add an override to the new value.
 */
export function updateOverrides<T extends object>(
	curObj: ReadonlyDeep<ObjectWithOverrides<T>>,
	rawObj: ReadonlyDeep<T>
): ObjectWithOverrides<T> {
	const result: ObjectWithOverrides<T> = { defaults: clone(curObj.defaults), overrides: [] }
	for (const [key, value] of Object.entries<any>(rawObj)) {
		const override = curObj.overrides.find((ov) => {
			const parentPath = getParentObjectPath(ov.path)
			return key === (parentPath ? parentPath : ov.path)
		})
		if (override) {
			// Some or all members of the property are already overridden in curObj
			if (objectPath.has(rawObj, override.path)) {
				const rawValue = objectPath.get(rawObj, override.path)
				if (override.op === 'delete' || (override.op === 'set' && _.isEqual(rawValue, override.value))) {
					// Preserve all existing delete overrides and any set overrides where the value is not updated
					result.overrides.push(override)
				}
			}
		}

		// check the values of the raw object against the current object, generating an override for each difference
		const appliedCurObj = applyAndValidateOverrides(curObj).obj
		for (const [curKey, curValue] of Object.entries<any>(appliedCurObj)) {
			if (key === curKey && !_.isEqual(value, curValue)) {
				// Some or all members of the property have been modified
				if (typeof value === 'object') {
					// check one level down info the potentially modified object
					for (const [rawKey, rawValue] of Object.entries<any>(value)) {
						if (!_.isEqual(rawValue, curValue[rawKey])) {
							result.overrides.push(
								literal<ObjectOverrideSetOp>({
									op: 'set',
									path: `${key}.${rawKey}`,
									value: rawValue,
								})
							)
						}
					}
				} else {
					result.overrides.push(
						literal<ObjectOverrideSetOp>({
							op: 'set',
							path: key,
							value: value,
						})
					)
				}
			}
		}
		// }
	}
	return result
}

/**
 * Combine the ObjectWithOverrides to give the simplified object.
 * Also performs validation of the overrides, and classifies them
 * Note: No validation is done to make sure the type conforms to the typescript definition. It is assumed that the definitions which drive ui ensure that they dont violate the typings, and that any changes will be backwards compatible with old overrides
 */
export function applyAndValidateOverrides<T extends object>(
	obj: ReadonlyDeep<ObjectWithOverrides<T>>
): ApplyOverridesResult<T> {
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
			if (operation.value === undefined) {
				objectPath.del(result.obj, operation.path)
			} else {
				objectPath.set(result.obj, operation.path, clone(operation.value))
			}
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
