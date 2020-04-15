import { PeripheralDeviceAPI } from '../api/peripheralDevice'
import { Time, registerCollection, ProtectedString } from '../lib'
import { TransformedCollection } from '../typings/meteor'
import { Meteor } from 'meteor/meteor'

import { MediaManagerDeviceSettings } from './PeripheralDeviceSettings/mediaManager'
import { PlayoutDeviceSettings } from './PeripheralDeviceSettings/playoutDevice'
import { MosDeviceSettings } from './PeripheralDeviceSettings/mosDevice'
import { SpreadsheetDeviceSettings, SpreadsheetDeviceSecretSettings } from './PeripheralDeviceSettings/spreadsheet'
import { INewsDeviceSettings } from './PeripheralDeviceSettings/iNews'
import { createMongoCollection } from './lib'
import { DeviceConfigManifest } from '../api/deviceConfig'
import { StudioId } from './Studios'
import { OrganizationId } from './Organization'

/** A string, identifying a PeripheralDevice */
export type PeripheralDeviceId = ProtectedString<'PeripheralDeviceId'>

export interface PeripheralDevice {
	_id: PeripheralDeviceId

	/** If set, this device is owned by that organization */
	organizationId: OrganizationId | null

	name: string

	category: PeripheralDeviceAPI.DeviceCategory
	type: PeripheralDeviceAPI.DeviceType
	subType: PeripheralDeviceAPI.DeviceSubType

	/** The studio this device is assigned to. Will be undefined for sub-devices */
	studioId?: StudioId
	parentDeviceId?: PeripheralDeviceId
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
	connectionId: string | null // Id of the current ddp-Connection

	token: string

	settings?: MosDeviceSettings | PlayoutDeviceSettings | MediaManagerDeviceSettings | SpreadsheetDeviceSettings | INewsDeviceSettings

	secretSettings?: any | SpreadsheetDeviceSecretSettings

	/** Ignore this device when computing status in the GUI (other status reports are unaffected) */
	ignore?: boolean

	configManifest: DeviceConfigManifest
}

export interface MosParentDevice extends PeripheralDevice {
	category: PeripheralDeviceAPI.DeviceCategory.INGEST,
	type: PeripheralDeviceAPI.DeviceType.MOS,
	subType: PeripheralDeviceAPI.SUBTYPE_PROCESS,
	settings?: MosDeviceSettings
	secretSettings: undefined
	lastDataReceived?: Time
}
export interface PlayoutParentDevice extends PeripheralDevice {
	category: PeripheralDeviceAPI.DeviceCategory.PLAYOUT,
	type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
	subType: PeripheralDeviceAPI.SUBTYPE_PROCESS,
	secretSettings: undefined
	settings?: PlayoutDeviceSettings
}
export interface MediaManagerDevice extends PeripheralDevice {
	category: PeripheralDeviceAPI.DeviceCategory.MEDIA_MANAGER,
	type: PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER,
	subType: PeripheralDeviceAPI.SUBTYPE_PROCESS,
	secretSettings: undefined
	settings?: MediaManagerDeviceSettings
}
export interface SpreadsheetDevice extends PeripheralDevice {
	category: PeripheralDeviceAPI.DeviceCategory.INGEST,
	type: PeripheralDeviceAPI.DeviceType.SPREADSHEET,
	subType: PeripheralDeviceAPI.SUBTYPE_PROCESS,
	settings?: SpreadsheetDeviceSettings
	secretSettings?: SpreadsheetDeviceSecretSettings
	accessTokenUrl?: string
}
export interface INewsDevice extends PeripheralDevice {
	category: PeripheralDeviceAPI.DeviceCategory.INGEST,
	type: PeripheralDeviceAPI.DeviceType.INEWS,
	subType: PeripheralDeviceAPI.SUBTYPE_PROCESS,
	settings?: INewsDeviceSettings
}

export const PeripheralDevices: TransformedCollection<PeripheralDevice, PeripheralDevice>
	= createMongoCollection<PeripheralDevice>('peripheralDevices')
registerCollection('PeripheralDevices', PeripheralDevices)
Meteor.startup(() => {
	if (Meteor.isServer) {
		PeripheralDevices._ensureIndex({
			organizationId: 1,
			studioId: 1
		})
		PeripheralDevices._ensureIndex({
			studioId: 1
		})
		PeripheralDevices._ensureIndex({
			token: 1
		})
	}
})

export function getStudioIdFromDevice (peripheralDevice: PeripheralDevice): StudioId | undefined {
	if (peripheralDevice.studioId) {
		return peripheralDevice.studioId
	}
	if (peripheralDevice.parentDeviceId) {
		// Also check the parent device:
		const parentDevice = PeripheralDevices.findOne(peripheralDevice.parentDeviceId)
		if (parentDevice) {
			return parentDevice.studioId
		}
	}
	return undefined
}
