import { Mongo } from 'meteor/mongo'
import { PeripheralDeviceAPI } from '../api/peripheralDevice'
import { Time, registerCollection } from '../lib'
import { TransformedCollection } from '../typings/meteor'
import { Meteor } from 'meteor/meteor'

import { MediaManagerDeviceSettings } from './PeripheralDeviceSettings/mediaManager'
import { PlayoutDeviceSettings } from './PeripheralDeviceSettings/playoutDevice'
import { MosDeviceSettings } from './PeripheralDeviceSettings/mosDevice'
import { SpreadsheetDeviceSettings, SpreadsheetDeviceSecretSettings } from './PeripheralDeviceSettings/spreadsheet'

export interface PeripheralDevice {
	_id: string

	name: string
	type: PeripheralDeviceAPI.DeviceType

	/** The studio this device is assigned to. Will be undefined for sub-devices */
	studioId?: string
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

	settings?: MosDeviceSettings | PlayoutDeviceSettings | MediaManagerDeviceSettings | SpreadsheetDeviceSettings

	secretSettings?: any | SpreadsheetDeviceSecretSettings
}

export interface MosDevice extends PeripheralDevice {
	type: PeripheralDeviceAPI.DeviceType.MOSDEVICE,
	settings?: MosDeviceSettings
	secretSettings: undefined
	lastDataReceived?: Time
}
export interface PlayoutDevice extends PeripheralDevice {
	type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
	secretSettings: undefined
	settings?: PlayoutDeviceSettings
}
export interface MediaManagerDevice extends PeripheralDevice {
	type: PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER,
	secretSettings: undefined
	settings?: MediaManagerDeviceSettings
}
export interface SpreadsheetDevice extends PeripheralDevice {
	type: 4, // PeripheralDeviceAPI.DeviceType.SPREADSHEET, TODO
	settings?: SpreadsheetDeviceSettings
	secretSettings?: SpreadsheetDeviceSecretSettings
	accessTokenUrl?: string
}

export const PeripheralDevices: TransformedCollection<PeripheralDevice, PeripheralDevice>
	= new Mongo.Collection<PeripheralDevice>('peripheralDevices')
registerCollection('PeripheralDevices', PeripheralDevices)
Meteor.startup(() => {
	if (Meteor.isServer) {
		PeripheralDevices._ensureIndex({
			studioId: 1
		})
	}
})
