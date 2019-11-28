import {
	DeviceOptionsAny
} from 'timeline-state-resolver-types'

export interface PlayoutDeviceSettings {
	devices: {
		[deviceId: string]: DeviceOptionsAny
	}
	mediaScanner: {
		host: string
		port: number
	}
	multiThreading?: boolean
	multiThreadedResolver?: boolean
}
