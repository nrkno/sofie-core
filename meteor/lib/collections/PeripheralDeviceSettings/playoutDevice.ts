import {
	DeviceType as PlayoutDeviceType,
	DeviceOptions as PlayoutDeviceSettingsDevice,
	CasparCGOptions,
	AtemOptions,
	HyperdeckOptions
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

export interface PlayoutDeviceSettingsDeviceCasparCG extends PlayoutDeviceSettingsDevice {
	type: PlayoutDeviceType.CASPARCG
	options: CasparCGOptions
}
export interface PlayoutDeviceSettingsDeviceAtem extends PlayoutDeviceSettingsDevice {
	type: PlayoutDeviceType.ATEM
	options: AtemOptions
}

export interface PanasonicDeviceSettings {
	identifier: string
	url: string
}

export interface PlayoutDeviceSettingsDevicePanasonicPTZ extends PlayoutDeviceSettingsDevice {
	type: PlayoutDeviceType.PANASONIC_PTZ
	options: {
		cameraDevices: Array<PanasonicDeviceSettings>
	}
}

export interface PlayoutDeviceSettingsDeviceHyperdeck extends PlayoutDeviceSettingsDevice {
	type: PlayoutDeviceType.HYPERDECK
	options: HyperdeckOptions
}
export interface PlayoutDeviceSettingsDevicePharos extends PlayoutDeviceSettingsDevice {
	type: PlayoutDeviceType.PHAROS
	options: {
		host: string,
		spart?: boolean
	}
}
