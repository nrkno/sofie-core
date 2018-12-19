import { Mongo } from 'meteor/mongo'
import { PeripheralDeviceAPI } from '../api/peripheralDevice'
import { Time, registerCollection } from '../lib'
import { TransformedCollection } from '../typings/meteor'
import { Meteor } from 'meteor/meteor'
import {
	DeviceType as PlayoutDeviceType,
	DeviceOptions as PlayoutDeviceSettingsDevice,
	CasparCGOptions,
	AtemOptions,
	HyperdeckOptions
} from 'timeline-state-resolver-types'

export interface PeripheralDevice {
	_id: string

	name: string
	type: PeripheralDeviceAPI.DeviceType

	studioInstallationId: string
	parentDeviceId?: string
	/** Versions reported from the device */
	versions?: {
		[libraryName: string]: string
	}
	/** Expected versions (at least this) */
	expectedVersions?: {
		[libraryName: string]: string
	}

	created: Time
	status: PeripheralDeviceAPI.StatusObject
	lastSeen: Time // Updated continously while connected
	lastConnected: Time // Updated upon connection, not continously

	connected: boolean
	connectionId: string|null // Id of the current ddp-Connection

	token: string

	settings?: MosDeviceSettings | PlayoutDeviceSettings
}

export interface MosDevice extends PeripheralDevice {
	type: PeripheralDeviceAPI.DeviceType.MOSDEVICE,

	settings?: MosDeviceSettings

	lastDataReceived?: Time
}

export interface MosDeviceSettings {
	mosId: string,
	devices: {
		[deviceId: string]: MosDeviceSettingsDevice
	}
}
export interface MosDeviceSettingsDevice {
	primary: MosDeviceSettingsDeviceOptions
	secondary?: MosDeviceSettingsDeviceOptions
}
export interface MosDeviceSettingsDeviceOptions {
	id: string
	host: string
}

export interface PlayoutDeviceSettings {
	devices: {
		[deviceId: string]: PlayoutDeviceSettingsDevice
	}
	mediaScanner: {
		host: string
		port: number
	}
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
		ssl?: boolean
	}
}

export const PeripheralDevices: TransformedCollection<PeripheralDevice, PeripheralDevice>
	= new Mongo.Collection<PeripheralDevice>('peripheralDevices')
registerCollection('PeripheralDevices', PeripheralDevices)
Meteor.startup(() => {
	if (Meteor.isServer) {
		PeripheralDevices._ensureIndex({
			studioInstallationId: 1
		})
	}
})
