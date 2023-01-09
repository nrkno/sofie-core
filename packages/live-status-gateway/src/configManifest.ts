import { DeviceConfigManifest, ConfigManifestEntryType } from '@sofie-automation/server-core-integration'

export const LIVE_STATUS_DEVICE_CONFIG: DeviceConfigManifest = {
	deviceConfig: [
		{
			id: 'debugLogging',
			name: 'Activate Debug Logging',
			type: ConfigManifestEntryType.BOOLEAN,
		},
	],
}
