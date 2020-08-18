import { Meteor } from 'meteor/meteor'
import { MediaManagerAPI } from '../api/mediaManager'
import { ProtectedString, registerCollection } from '../lib'
import { TransformedCollection } from '../typings/meteor'
import { createMongoCollection } from './lib'
import { MediaWorkFlowId } from './MediaWorkFlows'
import { PeripheralDeviceId } from './PeripheralDevices'
import { StudioId } from './Studios'

/** A string, identifying a MediaWorkFlowStep */
export type MediaWorkFlowStepId = ProtectedString<'MediaWorkFlowStepId'>

export abstract class MediaWorkFlowStep {
	_id: MediaWorkFlowStepId
	_rev: string

	/** Which device this workflow originated from */
	deviceId: PeripheralDeviceId
	studioId: StudioId

	workFlowId: MediaWorkFlowId
	action: string
	status: MediaManagerAPI.WorkStepStatus
	messages?: Array<string>

	priority: number
	/** 0-1 */
	progress?: number
	criticalStep?: boolean
	/** Calculated time left of this step */
	expectedLeft?: number
}

export const MediaWorkFlowSteps: TransformedCollection<MediaWorkFlowStep, MediaWorkFlowStep> = createMongoCollection<
	MediaWorkFlowStep
>('mediaWorkFlowSteps')
registerCollection('MediaWorkFlowSteps', MediaWorkFlowSteps)
Meteor.startup(() => {
	if (Meteor.isServer) {
		MediaWorkFlowSteps._ensureIndex({
			deviceId: 1,
		})
		MediaWorkFlowSteps._ensureIndex({
			workFlowId: 1,
		})
		MediaWorkFlowSteps._ensureIndex({
			status: 1,
			priority: 1,
		})
	}
})
