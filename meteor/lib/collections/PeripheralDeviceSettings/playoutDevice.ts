import { TSR } from '@sofie-automation/blueprints-integration'

/**
 * The basic PlayoutDevice settings structure.
 * Note: playout-gateway will likely have more than this here, but this is that core needs to know about
 */
export interface PlayoutDeviceSettings {
	devices: {
		[deviceId: string]: TSR.DeviceOptionsAny
	}
	locations: {
		[deviceId: string]: any // todo
	}
}
