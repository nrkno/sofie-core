import {
	DeviceOptionsAny as PlayoutDeviceSettingsDevice,
} from 'timeline-state-resolver-types'

export interface PlayoutDeviceSettings {
	devices: {
		[deviceId: string]: PlayoutDeviceSettingsDevice
	}
	mediaScanner: {
		host: string
		port: number
	}
	multiThreading?: boolean
	multiThreadedResolver?: boolean
}
