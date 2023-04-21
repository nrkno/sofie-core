import { PeripheralDeviceId, StudioId } from './Ids'
import {
	PeripheralDeviceStatusObject,
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	PeripheralDeviceSubType,
} from '../../peripheralDevice/peripheralDeviceAPI'
import { SubdeviceAction } from '../deviceConfigManifest'

export type GenericPeripheralDeviceSettings = Record<string, never>
// export interface GenericPeripheralDeviceSettings {
// 	// devices?: Record<string, unknown>
// 	// [key: string]: unknown
// }

export interface PeripheralDevicePublic {
	_id: PeripheralDeviceId

	/** Name of the device (set by the device, modifiable by user) */
	name: string

	/** Name of the device (set by the device) */
	deviceName: string

	/** The studio this device is assigned to. Will be undefined for sub-devices */
	studioId?: StudioId

	category: PeripheralDeviceCategory
	type: PeripheralDeviceType
	subType: PeripheralDeviceSubType

	parentDeviceId?: PeripheralDeviceId

	/** When the device was initially created [unix-timestamp] */
	created: number
	status: PeripheralDeviceStatusObject

	settings: IngestDeviceSettings | GenericPeripheralDeviceSettings
}

/**
 * An extension of PeripheralDevicePublic to expose the available actions to the blueprints.
 */
export interface PeripheralDevicePublicWithActions extends PeripheralDevicePublic {
	/** Available actions for the device */
	actions: SubdeviceAction[] | undefined
}

export interface IngestDeviceSettings {
	/** OAuth: Set to true when secret value exists */
	secretCredentials: boolean
	secretAccessToken: boolean
}
export interface IngestDeviceSecretSettings {
	/** OAuth: */
	credentials?: Credentials
	accessToken?: AccessToken
}
export interface Credentials {
	installed: {
		client_id: string
		project_id: string
		auth_uri: string
		token_uri: string
		auth_provider_x509_cert_url: string
		client_secret: string
		redirect_uris: string[]
	}
}
export interface AccessToken {
	access_token: string
	refresh_token: string
	scope: string
	token_type: string
	expiry_date: number
}
