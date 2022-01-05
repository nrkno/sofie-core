import { createMongoCollection } from './lib'
import { MediaManagerAPI } from '../api/mediaManager'
import { registerIndex } from '../database'
import {
	MediaWorkFlowStepId,
	StudioId,
	PeripheralDeviceId,
	MediaWorkFlowId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
export { MediaWorkFlowStepId }

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

export const MediaWorkFlowSteps = createMongoCollection<MediaWorkFlowStep>(CollectionName.MediaWorkFlowSteps)

registerIndex(MediaWorkFlowSteps, {
	deviceId: 1,
})
registerIndex(MediaWorkFlowSteps, {
	workFlowId: 1,
})
registerIndex(MediaWorkFlowSteps, {
	status: 1,
	priority: 1,
})
