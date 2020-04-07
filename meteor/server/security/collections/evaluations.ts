import { Evaluations, Evaluation } from '../../../lib/collections/Evaluations'

export namespace EvaluationsSecurity {
	export function allowReadAccess (selector: object, context: any) {

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
		return true
	},
	update (userId, doc, fields, modifier) {
		return false
	},
	remove (userId, doc) {
		return false
	}
})
