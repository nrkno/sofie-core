import { Meteor } from 'meteor/meteor'
import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'
import { rejectFields } from './lib'

export namespace StudioInstallationsSecurity {
	export function allowReadAccess (selector: object, token: string, context: any) {

		return true
		// TODO: implement some security here
	}
	export function allowWriteAccess () {
		// TODO
	}
}
// Setup rules:

// Setup rules:
StudioInstallations.allow({
	insert (userId: string, doc: StudioInstallation): boolean {
		return false
	},
	update (userId, doc, fields, modifier) {
		return rejectFields(fields, [
			'_id'
		])
	},
	remove (userId, doc) {
		return false
	}
})
