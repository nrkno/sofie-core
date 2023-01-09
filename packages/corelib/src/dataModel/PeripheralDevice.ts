import { Time } from '@sofie-automation/blueprints-integration'
import { assertNever } from '../lib'
import { DeviceConfigManifest } from '../deviceConfig'
import { PeripheralDeviceId, OrganizationId } from './Ids'

import {
	PeripheralDeviceStatusObject,
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	PeripheralDeviceSubType,
	PERIPHERAL_SUBTYPE_PROCESS,
	MOS_DeviceType,
	Spreadsheet_DeviceType,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'

export {
	PeripheralDeviceStatusObject,
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	PeripheralDeviceSubType,
	PERIPHERAL_SUBTYPE_PROCESS,
	MOS_DeviceType,
	Spreadsheet_DeviceType,
}

import {
	IngestDeviceSecretSettings,
	PeripheralDevicePublic,
} from '@sofie-automation/shared-lib/dist/core/model/peripheralDevice'

export interface PeripheralDevice extends PeripheralDevicePublic {
	/** If set, this device is owned by that organization */
	organizationId: OrganizationId | null

	/** Name of the device (set by the device) */
	deviceName?: string

	category: PeripheralDeviceCategory
	type: PeripheralDeviceType
	subType: PeripheralDeviceSubType

	parentDeviceId?: PeripheralDeviceId
	/** Versions reported from the device */
	versions?: {
		[libraryName: string]: string
	}
	/** Whether version checks should be disabled for this version */
	disableVersionChecks?: boolean

	created: Time
	status: PeripheralDeviceStatusObject
	lastSeen: Time // Updated continously while connected
	lastConnected: Time // Updated upon connection, not continously

	/** A list of last reported latencies */
	latencies?: number[]

	connected: boolean
	connectionId: string | null // Id of the current ddp-Connection

	token: string

	secretSettings?: IngestDeviceSecretSettings | { [key: string]: any }

	/** Ignore this device when computing status in the GUI (other status reports are unaffected) */
	ignore?: boolean

	configManifest: DeviceConfigManifest

	/** If this is an ingest gateway, the last tiem data was received */
	lastDataReceived?: Time

	/** If an ingest device performing an oauth flow */
	accessTokenUrl?: string
}

export function getExternalNRCSName(device: PeripheralDevice | undefined): string {
	if (device) {
		if (device.category === PeripheralDeviceCategory.INGEST) {
			if (device.type === PeripheralDeviceType.MOS) {
				// This is a hack, to be replaced with something better later:
				return 'ENPS'
			} else if (device.type === PeripheralDeviceType.INEWS) {
				return 'iNews'
			} else if (device.type === PeripheralDeviceType.SPREADSHEET) {
				return 'Google Sheet'
			} else if (
				device.type === PeripheralDeviceType.PLAYOUT ||
				device.type === PeripheralDeviceType.MEDIA_MANAGER ||
				device.type === PeripheralDeviceType.PACKAGE_MANAGER ||
				device.type === PeripheralDeviceType.LIVE_STATUS
			) {
				// These aren't ingest gateways
			} else {
				assertNever(device.type)
			}
		}
		// The device type is unknown to us:
		return `Unknown NRCS: "${device.type}"`
	} else {
		// undefined NRCS:
		return 'NRCS'
	}
}
