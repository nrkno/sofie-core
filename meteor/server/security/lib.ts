import * as _ from 'underscore'
/**
 * Allow only edits to the fields specified. Edits to any other fields will be rejected
 * @param fieldNames
 * @param allowFields
 */
export function allowOnlyFields (fieldNames: string[], allowFields: string[]) {
	let allow: boolean = true
	_.find(fieldNames, (field) => {
		if (allowFields.indexOf(field) === -1) {
			allow = false
			return true
		}
	})
	return allow
}
/**
 * Don't allow edits to the fields specified. All other edits are approved
 * @param fieldNames
 * @param rejectFields
 */
export function rejectFields (fieldNames: string[], rejectFields: string[]) {
	let allow: boolean = true
	_.find(fieldNames, (field) => {
		if (rejectFields.indexOf(field) !== -1) {
			allow = false
			return true
		}
	})
	return allow
}

// console.log(allowOnlyFields(['_id', 'name'], ['name', 'modified']) === false, '_id not allowed')
// console.log(allowOnlyFields(['name'], ['name', 'modified']) === true, 'should be ok')
// console.log(rejectFields(['_id', 'name'], ['_id']) === false, '_id not allowed')
// console.log(rejectFields(['name'], ['_id']) === true, 'should be ok')
