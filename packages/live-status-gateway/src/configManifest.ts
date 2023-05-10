import { DeviceConfigManifest, JSONBlobStringify, JSONSchema } from '@sofie-automation/server-core-integration'

import ConfigSchema = require('./$schemas/options.json')

export const LIVE_STATUS_DEVICE_CONFIG: DeviceConfigManifest = {
	deviceConfigSchema: JSONBlobStringify<JSONSchema>(ConfigSchema as any),
	subdeviceManifest: {},
}
