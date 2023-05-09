import {
	DeviceConfigManifest,
	JSONBlob,
	JSONBlobStringify,
	JSONSchema,
	SubdeviceManifest,
} from '@sofie-automation/server-core-integration'
import { TSRDevicesManifest, manifest as TSRManifest } from 'timeline-state-resolver'

import Translations = require('timeline-state-resolver/dist/translations.json')

import ConfigSchema = require('./$schemas/options.json')

const subdeviceManifest: SubdeviceManifest = Object.fromEntries(
	Object.entries<TSRDevicesManifest[0]>(TSRManifest.subdevices).map(([id, dev]) => {
		return [
			id,
			{
				displayName: dev.displayName,
				configSchema: stringToJsonBlob(dev.configSchema),
				playoutMappings: Object.fromEntries<JSONBlob<JSONSchema>>(
					Object.entries<string>(dev.mappingsSchemas).map(([id, str]) => [id, stringToJsonBlob(str)])
				),
				actions: dev.actions?.map((action) => ({
					...action,
					payload: action.payload ? stringToJsonBlob(action.payload) : undefined,
				})),
			},
		]
	})
)

export const PLAYOUT_DEVICE_CONFIG: DeviceConfigManifest = {
	deviceConfigSchema: JSONBlobStringify<JSONSchema>(ConfigSchema as any),

	subdeviceConfigSchema: stringToJsonBlob(TSRManifest.commonOptions),
	subdeviceManifest,

	translations: Translations as any,
}

function stringToJsonBlob(str: string): JSONBlob<JSONSchema> {
	return str as unknown as JSONBlob<JSONSchema>
}
