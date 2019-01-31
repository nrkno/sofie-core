import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection, Time } from '../lib'
import { Meteor } from 'meteor/meteor'

export enum WorkStepStatus {
	IDLE = 'idle',
	WORKING = 'working',
	DONE = 'done',
	ERROR = 'error',
	CANCELED = 'canceled',
	BLOCKED = 'blocked'
}

export abstract class MediaWorkFlowStep {
	_id: string
	_rev: string

	studioInstallationId: string

	mediaWorkFlowId: string
	action: string
	status: WorkStepStatus
	messages?: Array<string>

	priority: number
	/** 0-1 */
	progress?: number
	/** Calculated time left of this step */
	expectedLeft?: number
}

export const MediaWorkFlowSteps: TransformedCollection<MediaWorkFlowStep, MediaWorkFlowStep>
	= new Mongo.Collection<MediaWorkFlowStep>('mediaWorkFlowSteps')
registerCollection('MediaWorkFlowSteps', MediaWorkFlowSteps)
Meteor.startup(() => {
	if (Meteor.isServer) {
		MediaWorkFlowSteps._ensureIndex({
			mediaWorkFlowId: 1
		})
		MediaWorkFlowSteps._ensureIndex({
			status: 1,
			priority: 1
		})
	}
})