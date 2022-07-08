import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { MediaWorkFlowStepId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { MediaWorkFlowStep } from '@sofie-automation/shared-lib/dist/core/model/MediaWorkFlowSteps'
export { MediaWorkFlowStepId, MediaWorkFlowStep }

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
