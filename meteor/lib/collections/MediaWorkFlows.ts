import { Time } from '../lib'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { MediaWorkFlowId, StudioId, PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
export { MediaWorkFlowId }

export interface MediaWorkFlow {
	_id: MediaWorkFlowId
	_rev: string

	name?: string
	/** A secondary name, some kind of a comment about the workFlow */
	comment?: string

	/** Which device this workflow originated from */
	deviceId: PeripheralDeviceId
	studioId: StudioId

	source: string
	/** Id of the expectedMedia Item */
	expectedMediaItemId?: string[]
	mediaObjectId?: string
	created: Time

	priority: number

	finished: boolean
	success: boolean
}

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
