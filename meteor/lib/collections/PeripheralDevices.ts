import { Mongo } from 'meteor/mongo'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { Time } from '../../lib/lib'
import { TransformedCollection } from '../typings/meteor'

export interface PeripheralDevice {
	_id: string

	name: string
	type: PeripheralDeviceAPI.DeviceType

	studioInstallationId: string
	parentDeviceId?: string

	created: Time
	status: PeripheralDeviceAPI.StatusObject
	lastSeen: Time

	connected: boolean
	connectionId: string|null // Id of the current ddp-Connection

	token: string

	settings?: MosDeviceSettings | PlayoutDeviceSettings

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
export enum PlayoutDeviceType { // to match DeviceType in TSR
	ABSTRACT = 0,
	CASPARCG = 1,
	ATEM = 2,
	LAWO = 3,
	HTTPSEND = 4
}

export interface PlayoutDeviceSettings {
	devices: {
		[deviceId: string]: PlayoutDeviceSettingsDevice
	}
	initializeAsClear: boolean
}
export interface PlayoutDeviceSettingsDevice {
	type: PlayoutDeviceType
	options?: {}
}
export interface PlayoutDeviceSettingsDeviceCasparCG extends PlayoutDeviceSettingsDevice {
	type: PlayoutDeviceType.CASPARCG
	options: {
		host: string,
		port: number,
		syncTimecode?: boolean
	}
}
export interface PlayoutDeviceSettingsDeviceAtem extends PlayoutDeviceSettingsDevice {
	type: PlayoutDeviceType.ATEM
	options: {
		host: string,
		port?: number
	}
}

export const PeripheralDevices: TransformedCollection<PeripheralDevice, PeripheralDevice>
	= new Mongo.Collection<PeripheralDevice>('peripheralDevices')
