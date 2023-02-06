/**
 * This file contains the manifest for the config as displayed in the server-core
 * UI.
 */
import { DeviceConfigManifest, ConfigManifestEntryType } from '@sofie-automation/server-core-integration'
import {
	DEFAULT_MOS_TIMEOUT_TIME,
	DEFAULT_MOS_HEARTBEAT_INTERVAL,
} from '@sofie-automation/shared-lib/dist/core/constants'

export const MOS_DEVICE_CONFIG_MANIFEST: DeviceConfigManifest = {
	deviceConfig: [
		{
			id: 'mosId',
			name: 'MOS ID of Mos-Gateway (Sofie MOS ID)',
			type: ConfigManifestEntryType.STRING,
			hint: 'MOS ID of the Sofie MOS device (ie our ID). Example: sofie.mos',
		},
		{
			id: 'debugLogging',
			name: 'Activate Debug Logging',
			type: ConfigManifestEntryType.BOOLEAN,
		},
		{
			id: 'strict',
			name: '(Optional) Strict MOS data handling',
			type: ConfigManifestEntryType.BOOLEAN,
			hint: `When set, the MOS-connection will follow the MOS-specification literally (one example is that it wont accept certain strings that are longer than 128 characters)`,
		},
		{
			id: 'devices',
			name: 'Attached SubDevices',
			type: ConfigManifestEntryType.TABLE,
			isSubDevices: true,
			defaultType: 'default',
			config: {
				default: [
					{
						id: 'primary.id',
						name: 'Primary ID',
						columnName: 'Primary ID',
						type: ConfigManifestEntryType.STRING,
						hint: 'MOS ID of the Newsroom System (NRCS) we connect to',
					},
					{
						id: 'primary.host',
						name: 'Primary Host',
						columnName: 'Host',
						type: ConfigManifestEntryType.STRING,
						hint: 'IP or Hostname',
					},
					{
						id: 'primary.dontUseQueryPort',
						name: `Don't use the Query port`,
						columnName: 'No query',
						type: ConfigManifestEntryType.BOOLEAN,
					},
					{
						id: 'primary.timeout',
						name: '(Optional) Timeout (ms)',
						columnName: 'Timeout',
						type: ConfigManifestEntryType.INT,
						hint: `Timeout for sent messages, default is ${DEFAULT_MOS_TIMEOUT_TIME}`,
					},
					{
						id: 'primary.heartbeatInterval',
						name: '(Optional) Heartbeat interval (ms)',
						columnName: 'Heartbeat',
						type: ConfigManifestEntryType.INT,
						hint: `How often to ping NRCS to determine connection status, default is ${DEFAULT_MOS_HEARTBEAT_INTERVAL}`,
					},
					{
						id: 'secondary.id',
						name: 'Secondary ID',
						columnName: 'Secondary ID',
						type: ConfigManifestEntryType.STRING,
						hint: 'MOS ID of the Newsroom System (NRCS) we connect to',
					},
					{
						id: 'secondary.host',
						name: 'Secondary Host',
						columnName: 'Host',
						type: ConfigManifestEntryType.STRING,
						hint: 'IP or Hostname',
					},
					{
						id: 'secondary.dontUseQueryPort',
						name: `Secondary: Don't use the Query port`,
						columnName: 'No query',
						type: ConfigManifestEntryType.BOOLEAN,
					},
					{
						id: 'secondary.timeout',
						name: 'Secondary: (Optional) Timeout (ms)',
						columnName: 'Timeout',
						type: ConfigManifestEntryType.INT,
						hint: `Timeout for sent messages, default is ${DEFAULT_MOS_TIMEOUT_TIME}`,
					},
					{
						id: 'secondary.heartbeatInterval',
						name: 'Secondary: (Optional) Heartbeat interval (ms)',
						columnName: 'Heartbeat',
						type: ConfigManifestEntryType.INT,
						hint: `How often to ping NRCS to determine connection status, default is ${DEFAULT_MOS_HEARTBEAT_INTERVAL}`,
					},
				],
			},
		},
	],
}
