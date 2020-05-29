import { MediaWorkFlows, MediaWorkFlow } from '../../lib/collections/MediaWorkFlows'
import { MediaWorkFlowSteps, MediaWorkFlowStep } from '../../lib/collections/MediaWorkFlowSteps'

export namespace MediaWorkFlowStepsSecurity {
	export function allowReadAccess(selector: object, token: string, context: any) {
		return true
		// TODO: implement some security here
	}
	export function allowWriteAccess() {
		// TODO
	}
}

MediaWorkFlowSteps.allow({
	insert(userId: string, doc: MediaWorkFlowStep): boolean {
		return false
	},
	update(userId, doc, fields, modifier) {
		return false
	},
	remove(userId, doc) {
		return false
	},
})

export namespace MediaWorkFlowsSecurity {
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
MediaWorkFlows.allow({
	insert(userId: string, doc: MediaWorkFlow): boolean {
		return false
	},
	update(userId, doc, fields, modifier) {
		return false
	},
	remove(userId, doc) {
		return false
	},
})
