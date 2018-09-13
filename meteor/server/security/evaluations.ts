import { Meteor } from 'meteor/meteor'
import { Evaluations, Evaluation } from '../../lib/collections/Evaluations'

export namespace EvaluationsSecurity {
	export function allowReadAccess (selector: object, context) {

		return true
		// TODO: implement some security here
	}
	export function allowWriteAccess () {
		// TODO
	}
}

// Setup rules:
Evaluations.allow({
	insert (userId: string, doc: Evaluation): boolean {
		return true // Tmp: Allow everything client-side
	},
	update (userId, doc, fields, modifier) {
		return true // Tmp: Allow everything client-side
	},
	remove (userId, doc) {
		return true // Tmp: Allow everything client-side
	}
})
