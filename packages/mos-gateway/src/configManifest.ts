/**
 * This file contains the manifest for the config as displayed in the server-core
 * UI.
 */
import { DeviceConfigManifest } from '@sofie-automation/server-core-integration'
// import {
// 	DEFAULT_MOS_TIMEOUT_TIME,
// 	DEFAULT_MOS_HEARTBEAT_INTERVAL,
// } from '@sofie-automation/shared-lib/dist/core/constants'

import ConfigSchema = require('./configSchema.json')
import ConfigSchemaSubDevice = require('./configSchemaSubDevice.json')

export const MOS_DEVICE_CONFIG_MANIFEST: DeviceConfigManifest = {
	deviceConfigSchema: JSON.stringify(ConfigSchema),

	subdeviceManifest: {
		default: {
			displayName: 'MOS Device',
			configSchema: JSON.stringify(ConfigSchemaSubDevice),
		},
	},
}
