import { TSR } from 'tv-automation-sofie-blueprints-integration'

export interface PlayoutDeviceSettings {
	devices: {
		[deviceId: string]: TSR.DeviceOptionsAny
	}
	mediaScanner: {
		host: string
		port: number
	}
	multiThreading?: boolean
	multiThreadedResolver?: boolean
}
