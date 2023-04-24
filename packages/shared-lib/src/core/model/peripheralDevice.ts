import { TSR } from '../../tsr'
import { PeripheralDeviceId, StudioId } from './Ids'

export type GenericPeripheralDeviceSettings = Record<string, never>
// export interface GenericPeripheralDeviceSettings {
// 	// devices?: Record<string, unknown>
// 	// [key: string]: unknown
// }

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

export interface PeripheralDeviceForDevice {
	_id: PeripheralDeviceId

	// /** Name of the device (set by the device, modifiable by user) */
	// name: string

	// /** Name of the device (set by the device) */
	// deviceName: string

	/** The studio this device is assigned to */
	studioId?: StudioId

	// category: PeripheralDeviceCategory
	// type: PeripheralDeviceType
	// subType: PeripheralDeviceSubType

	// parentDeviceId?: PeripheralDeviceId

	// /** When the device was initially created [unix-timestamp] */
	// created: number
	// status: PeripheralDeviceStatusObject

	deviceSettings: unknown

	playoutDevices: Record<string, TSR.DeviceOptionsAny>
	ingestSubDevices: Record<string, unknown>
}
