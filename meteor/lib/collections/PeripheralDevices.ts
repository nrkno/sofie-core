import { Mongo } from 'meteor/mongo'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { Time } from '../../lib/lib'

export interface PeripheralDevice {
	_id: string

	name: string
	type: PeripheralDeviceAPI.DeviceType

	created: Time
	status: PeripheralDeviceAPI.StatusObject
	lastSeen: Time

	connected: boolean
	connectionId: string|null // Id of the current ddp-Connection

	token: string

	settings?: MosDeviceSettings | PlayoutDeviceSettings

}

export interface MosDeviceSettings { // TODO
}
export enum PlayoutDeviceType { // to match DeviceType in TSR
	ABSTRACT = 0,
	CASPARCG = 1,
	ATEM = 2
}
export interface Mappings {
	[layerName: string]: Mapping
}
export interface Mapping {
	device: PlayoutDeviceType,
	deviceId: string
	// [key: string]: any
}
export interface PlayoutDeviceSettings {
	devices: {
		[deviceId: string]: {
			type: PlayoutDeviceType
			options?: {}
		}
	}
	initializeAsClear: boolean
	mappings: Mappings,
}

export const PeripheralDevices = new Mongo.Collection<PeripheralDevice>('peripheralDevices')
