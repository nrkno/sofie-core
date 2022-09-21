import * as _ from 'underscore'
import { logger } from '../../logging'
import { FieldNames } from '../../../lib/typings/meteor'
/**
 * Allow only edits to the fields specified. Edits to any other fields will be rejected
 * @param doc
 * @param fieldNames
 * @param allowFields
 */
export function allowOnlyFields<T>(_doc: T, fieldNames: FieldNames<T>, allowFields: FieldNames<T>): boolean {
	// Note: _doc is only included to set the type T in this generic function
	let allow: boolean = true
	_.find(fieldNames, (field) => {
		if (allowFields.indexOf(field) === -1) {
			allow = false
			return true
		}
		return false
	})
	return allow
}
/**
 * Don't allow edits to the fields specified. All other edits are approved
 * @param doc
 * @param fieldNames
 * @param rejectFields
 */
export function rejectFields<T>(_doc: T, fieldNames: FieldNames<T>, rejectFields: FieldNames<T>): boolean {
	// Note: _doc is only included to set the type T in this generic function
	let allow: boolean = true
	_.find(fieldNames, (field) => {
		if (rejectFields.indexOf(field) !== -1) {
			allow = false
			return true
		}
		return false
	})
	return allow
}

export function logNotAllowed(area: string, reason: string): false {
	logger.warn(`Not allowed access to ${area}: ${reason}`)
	return false
}
