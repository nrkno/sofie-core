/**
 * This file contains the manifest for the config as displayed in the server-core
 * UI.
 */
import { DeviceConfigManifest } from '@sofie-automation/server-core-integration'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import { JSONBlobStringify } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'

// import {
// 	DEFAULT_MOS_TIMEOUT_TIME,
// 	DEFAULT_MOS_HEARTBEAT_INTERVAL,
// } from '@sofie-automation/shared-lib/dist/core/constants'

import ConfigSchema = require('./$schemas/options.json')
import ConfigSchemaSubDevice = require('./$schemas/devices.json')

export const MOS_DEVICE_CONFIG_MANIFEST: DeviceConfigManifest = {
	deviceConfigSchema: JSONBlobStringify<JSONSchema>(ConfigSchema as any),

	subdeviceManifest: {
		default: {
			displayName: 'MOS Device',
			configSchema: JSONBlobStringify<JSONSchema>(ConfigSchemaSubDevice as any),
		},
	},
}
