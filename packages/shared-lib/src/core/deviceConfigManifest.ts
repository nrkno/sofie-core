/**
 * A device has configuration options. This file describes a format using
 * typescript in which these options can be described.
 *
 * In general a device can have an array of configuration fields like strings,
 * booleans, numbers etc.
 *
 * A special type is the TABLE. This type describes another array of config
 * options. A table type is rendered as an actual table in core, where the rows
 * are instances of a certain type or are all the same. Manifests entries can
 * describe some properties to be rendered inside this table
 */

import { TSRActionSchema } from 'timeline-state-resolver-types'
import { TranslationsBundle } from '../lib/translations'

export interface DeviceConfigManifest {
	/**
	 * A description of the config fields
	 */
	deviceConfigSchema: string
	/**
	 * If the device has an OAuthFlow (like spreadsheet gw) the instructions for
	 * getting an authentication token go in here
	 */
	deviceOAuthFlow?: DeviceOAuthFlow
	/**
	 * A description of common properties for each subdevice
	 */
	subdeviceConfigSchema?: string
	/**
	 * A description of how to interact with subdevices
	 */
	subdeviceManifest: SubdeviceManifest
	/**
	 * Translations for any strings generated by the device that may be shown to the user
	 */
	translations?: TranslationsBundle[]
}

export type SubdeviceManifest<T extends string | number = string | number> = {
	[deviceType in T]: {
		displayName: string
		configSchema?: string
		playoutMappings?: Record<string, string>
		actions?: SubdeviceAction[]
	}
}

// Re-export from TSR
export type SubdeviceAction = TSRActionSchema

export interface DeviceOAuthFlow {
	credentialsHelp: string
	credentialsURL: string
}
