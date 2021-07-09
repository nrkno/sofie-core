import { Time } from '@sofie-automation/blueprints-integration'
import { PeripheralDeviceCommandId, PeripheralDeviceId } from './Ids'

export interface PeripheralDeviceCommand {
	_id: PeripheralDeviceCommandId

	deviceId: PeripheralDeviceId
	functionName: string
	args: Array<any>

	hasReply: boolean
	reply?: any
	replyError?: any
	replyTime?: number

	time: Time // time
}
