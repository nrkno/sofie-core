import { WorkStepStatus } from '../../peripheralDevice/mediaManager'
import { MediaWorkFlowId, MediaWorkFlowStepId, PeripheralDeviceId, StudioId } from './Ids'

export interface MediaWorkFlowStep {
	_id: MediaWorkFlowStepId
	_rev: string

	/** Which device this workflow originated from */
	deviceId: PeripheralDeviceId
	studioId: StudioId

	workFlowId: MediaWorkFlowId
	action: string
	status: WorkStepStatus
	messages?: Array<string>

	priority: number
	/** 0-1 */
	progress?: number
	criticalStep?: boolean
	/** Calculated time left of this step */
	expectedLeft?: number
}
