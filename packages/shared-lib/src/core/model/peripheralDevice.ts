import { PeripheralDeviceId, StudioId } from './Ids'

export interface PeripheralDevicePublic {
	_id: PeripheralDeviceId

	/** Name of the device (set by the device, modifiable by user) */
	name: string

	/** The studio this device is assigned to. Will be undefined for sub-devices */
	studioId?: StudioId

	settings: PlayoutDeviceSettings | IngestDeviceSettings | { [key: string]: any }
}

/**
 * The basic PlayoutDevice settings structure.
 * Note: playout-gateway will likely have more than this here, but this is that core needs to know about
 */
export interface PlayoutDeviceSettings {
	devices: {
		[deviceId: string]: unknown // TSR.DeviceOptionsAny
	}
	locations: {
		[deviceId: string]: any // todo
	}
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
