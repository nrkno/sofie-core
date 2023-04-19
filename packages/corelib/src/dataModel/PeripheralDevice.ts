import { Time } from '@sofie-automation/blueprints-integration'
import { DeviceConfigManifest } from '../deviceConfig'
import { OrganizationId } from './Ids'

import {
	PeripheralDeviceStatusObject,
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	PeripheralDeviceSubType,
	PERIPHERAL_SUBTYPE_PROCESS,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'

export {
	PeripheralDeviceStatusObject,
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	PeripheralDeviceSubType,
	PERIPHERAL_SUBTYPE_PROCESS,
}

import {
	IngestDeviceSecretSettings,
	PeripheralDevicePublic,
} from '@sofie-automation/shared-lib/dist/core/model/peripheralDevice'

export interface PeripheralDevice extends PeripheralDevicePublic {
	/** If set, this device is owned by that organization */
	organizationId: OrganizationId | null

	/** Versions reported from the device */
	versions?: {
		[libraryName: string]: string
	}
	/** Whether version checks should be disabled for this version */
	disableVersionChecks?: boolean

	lastSeen: Time // Updated continously while connected
	lastConnected: Time // Updated upon connection, not continously

	/** A list of last reported latencies */
	latencies?: number[]

	connected: boolean
	connectionId: string | null // Id of the current ddp-Connection

	token: string

	secretSettings?: IngestDeviceSecretSettings | { [key: string]: any }

	/** If the device is of category ingest, the name of the NRCS being used */
	nrcsName?: string

	documentationUrl?: string

	/** Ignore this device when computing status in the GUI (other status reports are unaffected) */
	ignore?: boolean

	configManifest: DeviceConfigManifest

	/** If this is an ingest gateway, the last tiem data was received */
	lastDataReceived?: Time

	/** If an ingest device performing an oauth flow */
	accessTokenUrl?: string
}

export function getExternalNRCSName(device: PeripheralDevice | undefined): string {
	if (device?.nrcsName && device.category === PeripheralDeviceCategory.INGEST) {
		return device.nrcsName
	} else {
		// undefined NRCS:
		return 'NRCS'
	}
}
