import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { EJSON } from 'meteor/ejson'

const hasOwn = Object.prototype.hasOwnProperty

/**
 * Perform a shallow diff of a pair of objects
 * @param oldDoc The original object
 * @param newDoc The new object
 * @returns The difference, or null if nothing changed
 */
export function diffObject<T extends { _id: ProtectedString<any> }>(oldDoc: T, newDoc: T): Partial<T> | null {
	const fields: Partial<T> = {}
	Object.keys(oldDoc).forEach((key) => {
		if (hasOwn.call(newDoc, key)) {
			if (!EJSON.equals(oldDoc[key], newDoc[key])) fields[key] = newDoc[key]
		} else {
			fields[key] = undefined
		}
	})

	Object.keys(newDoc).forEach((key) => {
		if (!hasOwn.call(oldDoc, key)) {
			fields[key] = newDoc[key]
		}
	})

	if (Object.keys(fields).length) return fields
	return null
}
