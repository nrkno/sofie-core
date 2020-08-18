import { Meteor } from 'meteor/meteor'
import { DeviceConfigManifest } from '../api/deviceConfig'
import { PeripheralDeviceAPI } from '../api/peripheralDevice'
import { ProtectedString, registerCollection, Time } from '../lib'
import { TransformedCollection } from '../typings/meteor'
import { createMongoCollection } from './lib'
import { OrganizationId } from './Organization'
import { IngestDeviceSecretSettings, IngestDeviceSettings } from './PeripheralDeviceSettings/ingestDevice'
import { PlayoutDeviceSettings } from './PeripheralDeviceSettings/playoutDevice'
import { StudioId } from './Studios'

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

	settings?: PlayoutDeviceSettings | IngestDeviceSettings | { [key: string]: any }

	secretSettings?: IngestDeviceSecretSettings | { [key: string]: any }

	/** Ignore this device when computing status in the GUI (other status reports are unaffected) */
	ignore?: boolean

	configManifest: DeviceConfigManifest

	/** If this is an ingest gateway, the last tiem data was received */
	lastDataReceived?: Time

	/** If an ingest device performing an oauth flow */
	accessTokenUrl?: string
}

export const PeripheralDevices: TransformedCollection<PeripheralDevice, PeripheralDevice> = createMongoCollection<
	PeripheralDevice
>('peripheralDevices')
registerCollection('PeripheralDevices', PeripheralDevices)
Meteor.startup(() => {
	if (Meteor.isServer) {
		PeripheralDevices._ensureIndex({
			organizationId: 1,
			studioId: 1,
		})
		PeripheralDevices._ensureIndex({
			studioId: 1,
		})
		PeripheralDevices._ensureIndex({
			token: 1,
		})
	}
})

export function getStudioIdFromDevice(peripheralDevice: PeripheralDevice): StudioId | undefined {
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
