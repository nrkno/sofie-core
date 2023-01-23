import { DeviceConfigManifest, SubdeviceManifest } from '@sofie-automation/server-core-integration'
import { manifest as TSRManifest } from 'timeline-state-resolver'

import Translations = require('timeline-state-resolver/dist/translations.json')

import ConfigSchema = require('./$schemas/options.json')

const subdeviceManifest: SubdeviceManifest = Object.fromEntries(
	Object.entries(TSRManifest.subdevices).map(([id, dev]) => {
		return [
			id,
			{
				displayName: dev.displayName,
				configSchema: dev.configSchema,
				playoutMappings: dev.mappingsSchemas,
				actions: dev.actions,
			},
		]
	})
)

export const PLAYOUT_DEVICE_CONFIG: DeviceConfigManifest = {
	deviceConfigSchema: JSON.stringify(ConfigSchema),

	subdeviceConfigSchema: TSRManifest.commonOptions,
	subdeviceManifest,

	translations: Translations as any,
}
