import { Blueprints, Blueprint } from '../../lib/collections/Blueprints'
import { allowOnlyFields } from './lib'

export namespace BlueprintsSecurity {
	export function allowReadAccess(selector: object, token: string, context: any) {
		return true
		// TODO: implement some security here
	}
	export function allowWriteAccess() {
		// TODO
	}
}
// Setup rules:

// Setup rules:
Blueprints.allow({
	insert(userId: string, doc: Blueprint): boolean {
		return false
	},
	update(userId, doc, fields, modifier) {
		return allowOnlyFields(fields, ['name'])
	},
	remove(userId, doc) {
		return false
	},
})
