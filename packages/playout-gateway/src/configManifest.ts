import {
	DeviceConfigManifest,
	ConfigManifestEntryType,
	MappingsManifest,
} from '@sofie-automation/server-core-integration'
import {
	DeviceType as TSRDeviceType,
	MappingAtemType,
	MappingHyperdeckType,
	MappingLawoType,
	MappingPanasonicPTZType,
	MappingSisyfosType,
	QuantelControlMode,
	MappingVmixType,
	MappingObsType,
	manifest as TSRManifest,
} from 'timeline-state-resolver'

import Translations = require('timeline-state-resolver/dist/translations.json')

import ConfigSchema = require('./configSchema.json')

// TODO: should come from types
enum EmberParameterType {
	Null = 'NULL',
	Integer = 'INTEGER',
	Real = 'REAL',
	String = 'STRING',
	Boolean = 'BOOLEAN',
	Trigger = 'TRIGGER',
	Enum = 'ENUM',
	Octets = 'OCTETS',
}

// If a device has no specific settings for a mapping, it should be added to this list
type NoMappingSettingsDeviceTypes =
	| TSRDeviceType.ABSTRACT
	| TSRDeviceType.HTTPSEND
	| TSRDeviceType.TCPSEND
	| TSRDeviceType.PHAROS
	| TSRDeviceType.OSC
	| TSRDeviceType.HTTPWATCHER
	| TSRDeviceType.VIZMSE
	| TSRDeviceType.SHOTOKU
	| TSRDeviceType.TELEMETRICS

type ImplementedMappingsManifest = Pick<MappingsManifest, Exclude<TSRDeviceType, NoMappingSettingsDeviceTypes>>

const MAPPING_MANIFEST: ImplementedMappingsManifest = {
	[TSRDeviceType.ATEM]: [
		{
			id: 'mappingType',
			type: ConfigManifestEntryType.ENUM,
			values: MappingAtemType,
			name: 'Mapping Type',
			includeInSummary: true,
		},
		{ id: 'index', type: ConfigManifestEntryType.INT, name: 'index', includeInSummary: true, zeroBased: true },
	],
	[TSRDeviceType.CASPARCG]: [
		{
			id: 'channel',
			name: 'Channel',
			type: ConfigManifestEntryType.INT,
			hint: 'The CasparCG channel to use (1 is the first)',
			includeInSummary: true,
		},
		{
			id: 'layer',
			name: 'Layer',
			type: ConfigManifestEntryType.INT,
			hint: 'The layer in a channel to use',
			includeInSummary: true,
		},
		{
			id: 'previewWhenNotOnAir',
			name: 'Preview when not On-Air',
			type: ConfigManifestEntryType.BOOLEAN,
			optional: true,
			hint: 'Whether to load to first frame',
		},
	],
	[TSRDeviceType.HYPERDECK]: [
		{
			id: 'mappingType',
			type: ConfigManifestEntryType.ENUM,
			values: MappingHyperdeckType,
			name: 'Mapping Type',
		},
	],
	[TSRDeviceType.LAWO]: [
		{
			id: 'mappingType',
			type: ConfigManifestEntryType.ENUM,
			values: MappingLawoType,
			name: 'Mapping Type',
		},
		{
			id: 'identifier',
			type: ConfigManifestEntryType.STRING,
			name: 'Identifier',
			includeInSummary: true,
		},
		{
			id: 'emberType',
			type: ConfigManifestEntryType.ENUM,
			values: EmberParameterType,
			name: 'Ember Type',
		},
		{
			id: 'priority',
			type: ConfigManifestEntryType.INT,
			name: 'Priority',
		},
	],
	[TSRDeviceType.PANASONIC_PTZ]: [
		{
			id: 'mappingType',
			type: ConfigManifestEntryType.ENUM,
			values: MappingPanasonicPTZType,
			name: 'Mapping Type',
			includeInSummary: true,
		},
	],
	[TSRDeviceType.QUANTEL]: [
		{
			id: 'portId',
			type: ConfigManifestEntryType.STRING,
			name: 'Port ID',
			hint: "The name you'd like the port to have",
			includeInSummary: true,
		},
		{
			id: 'channelId',
			type: ConfigManifestEntryType.INT,
			name: 'Channel ID',
			hint: 'The channel to use for output (0 is the first one)',
			includeInSummary: true,
		},
		{
			id: 'mode',
			type: ConfigManifestEntryType.ENUM,
			values: QuantelControlMode,
			name: 'Mode',
			optional: true,
		},
	],
	[TSRDeviceType.SINGULAR_LIVE]: [
		{
			id: 'compositionName',
			type: ConfigManifestEntryType.STRING,
			name: 'Composition Name',
		},
	],
	[TSRDeviceType.SISYFOS]: [
		{
			id: 'mappingType',
			type: ConfigManifestEntryType.ENUM,
			values: MappingSisyfosType,
			name: 'Mapping Type',
		},
		{
			id: 'channel',
			type: ConfigManifestEntryType.INT,
			name: 'Channel',
			optional: true,
			includeInSummary: true,
			zeroBased: true,
		},
		{
			id: 'label',
			type: ConfigManifestEntryType.STRING,
			name: 'Label',
			optional: true,
			includeInSummary: true,
			hint: 'Identify the channel by label (does not set the label in Sisyfos)',
		},
		{
			id: 'setLabelToLayerName',
			type: ConfigManifestEntryType.BOOLEAN,
			name: 'Set channel label to layer name',
		},
	],
	[TSRDeviceType.VMIX]: [
		{
			id: 'mappingType',
			type: ConfigManifestEntryType.ENUM,
			values: MappingVmixType,
			name: 'Mapping Type',
			includeInSummary: true,
		},
		{
			id: 'index',
			type: ConfigManifestEntryType.STRING,
			name: 'Index',
			includeInSummary: true,
			optional: true,
		},
		{
			id: 'inputLayer',
			type: ConfigManifestEntryType.STRING,
			name: 'Input Layer',
			includeInSummary: true,
			optional: true,
		},
	],
	[TSRDeviceType.OBS]: [
		{
			id: 'mappingType',
			type: ConfigManifestEntryType.ENUM,
			values: MappingObsType,
			name: 'Mapping Type',
			includeInSummary: true,
		},
		{
			id: 'source',
			type: ConfigManifestEntryType.STRING,
			name: 'Source',
			includeInSummary: true,
			optional: true,
		},
		{
			id: 'sceneName',
			type: ConfigManifestEntryType.STRING,
			name: 'Scene Name',
			includeInSummary: true,
			optional: true,
		},
	],
	[TSRDeviceType.SOFIE_CHEF]: [
		{
			id: 'windowId',
			type: ConfigManifestEntryType.STRING,
			name: 'Window ID',
			includeInSummary: true,
		},
	],
}

export const PLAYOUT_DEVICE_CONFIG: DeviceConfigManifest = {
	deviceConfigSchema: JSON.stringify(ConfigSchema),

	layerMappings: MAPPING_MANIFEST,

	subdeviceConfigSchema: TSRManifest.commonOptions,
	subdeviceManifest: TSRManifest.subdevices,

	translations: Translations as any,
}
