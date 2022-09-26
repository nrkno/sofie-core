import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { MediaWorkFlowId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { MediaWorkFlow } from '@sofie-automation/shared-lib/dist/core/model/MediaWorkFlows'
export { MediaWorkFlowId, MediaWorkFlow }

export const MediaWorkFlows = createMongoCollection<MediaWorkFlow>(CollectionName.MediaWorkFlows)

registerIndex(MediaWorkFlows, {
	// TODO: add deviceId: 1,
	mediaObjectId: 1,
})
registerIndex(MediaWorkFlows, {
	finished: 1,
	success: 1,
	priority: 1,
})
