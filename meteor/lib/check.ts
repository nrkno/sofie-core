import { check as MeteorCheck, Match as orgMatch } from 'meteor/check'

/* tslint:disable variable-name */

export function check(value: any, pattern: Match.Pattern) {
	// This is a wrapper for Meteor.check, since that asserts the returned type too strictly
	if (checkDisabled) {
		return
	}

	const passed = MeteorCheck(value, pattern)

	return passed
}
// todo: checkTOBEMOVED
export namespace Match {
	export const Any = orgMatch.Any
	// export const String = orgMatch.String
	export const Integer = orgMatch.Integer
	// export const Boolean = orgMatch.Boolean
	// export const undefined = orgMatch.undefined
	// export const Object = orgMatch.Object

	export type Pattern = orgMatch.Pattern
	export type PatternMatch<T extends Pattern> = orgMatch.PatternMatch<T>

	export function Maybe(pattern: any) {
		if (checkDisabled) return
		return orgMatch.Maybe(pattern)
	}
	export function Optional(pattern: any) {
		if (checkDisabled) return
		return orgMatch.Optional(pattern)
	}
	export function ObjectIncluding(dico: any) {
		if (checkDisabled) return
		return orgMatch.ObjectIncluding(dico)
	}
	export function OneOf(...patterns: any[]) {
		if (checkDisabled) return
		return orgMatch.OneOf(...patterns)
	}
	export function Where(condition: any) {
		if (checkDisabled) return
		return orgMatch.Where(condition)
	}
	export function test(value: any, pattern: any) {
		if (checkDisabled) return
		return orgMatch.test(value, pattern)
	}
}
let checkDisabled = false
export function disableChecks() {
	checkDisabled = true
}
export function enableChecks() {
	checkDisabled = false
}
