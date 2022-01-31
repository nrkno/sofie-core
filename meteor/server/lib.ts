import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'

export function getAbsolutePath(): string {
	// @ts-ignore Meteor.absolutePath is injected by the package ostrio:meteor-root
	return Meteor.absolutePath
}
export function extractFunctionSignature(f: Function): string[] | undefined {
	if (f) {
		const str = f.toString() || ''

		const m = str.match(/\(([^)]*)\)/)
		if (m) {
			const params = m[1].split(',')
			return _.map(params, (p) => {
				return p.trim()
			})
		}
	}
}
