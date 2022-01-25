/**
 * This file contains the manifest for the config as displayed in the server-core
 * UI.
 */
import { DeviceConfigManifest,ConfigManifestEntryType } from '@sofie-automation/server-core-integration'

export const MOS_DEVICE_CONFIG_MANIFEST: DeviceConfigManifest = {
	deviceConfig: [
		{
			id: 'mosId',
			name: 'MOS ID of Gateway (Sofie MOS ID)',
			type: ConfigManifestEntryType.STRING

		},
		{
			id: 'debugLogging',
			name: 'Activate Debug Logging',
			type: ConfigManifestEntryType.BOOLEAN
		},
		{
			id: 'devices',
			name: 'Attached SubDevices',
			type: ConfigManifestEntryType.TABLE,
			isSubDevices: true,
			defaultType: 'default',
			config: {
				'default': [
					{
						id: 'primary.id',
						name: 'Primary ID (Newsroom System MOS ID)',
						columnName: 'Primary ID',
						type: ConfigManifestEntryType.STRING
					},
					{
						id: 'primary.host',
						name: 'Primary Host (IP or Hostname)',
						columnName: 'Primary Host',
						type: ConfigManifestEntryType.STRING
					},
					{
						id: 'primary.dontUseQueryPort',
						name: `Don't use the Query port`,
						columnName: 'No query',
						type: ConfigManifestEntryType.BOOLEAN
					},
					{
						id: 'primary.timeout',
						name: '(Optional) Timeout (ms)',
						columnName: 'Timeout',
						type: ConfigManifestEntryType.INT
					},
					{
						id: 'secondary.id',
						name: 'Secondary ID (Newsroom System MOS ID)',
						columnName: 'Secondary ID',
						type: ConfigManifestEntryType.STRING
					},
					{
						id: 'secondary.host',
						name: 'Secondary Host (IP or Hostname)',
						columnName: 'Secondary Host',
						type: ConfigManifestEntryType.STRING
					},
					{
						id: 'secondary.dontUseQueryPort',
						name: `Don't use the Query port`,
						columnName: 'No query',
						type: ConfigManifestEntryType.BOOLEAN
					},
					{
						id: 'secondary.timeout',
						name: '(Optional) Timeout (ms)',
						columnName: 'Timeout',
						type: ConfigManifestEntryType.INT
					}
				]
			}
		}
	]
}
