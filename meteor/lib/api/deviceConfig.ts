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
 *
 * IMPORTANT - any updates done to this file should also be changed in
 * @sofie-automation/server-core-integration, such that the gateways can actually
 * implement it in the manifests.
 */

export interface DeviceConfigManifest {
	/**
	 * A description of the config fields
	 */
	deviceConfig: ConfigManifestEntry[]
	/**
	 * If the device has an OAuthFlow (like spreadsheet gw) the instructions for
	 * getting an authentication token go in here
	 */
	deviceOAuthFlow?: DeviceOAuthFlow
	/**
	 * A description of the layer mapping config fields
	 */
	layerMappings?: MappingsManifest
}

export interface DeviceOAuthFlow {
	credentialsHelp: string
	credentialsURL: string
}

export enum ConfigManifestEntryType {
	LABEL = 'label',
	LINK = 'link',
	STRING = 'string',
	MULTILINE_STRING = 'multiline_string',
	BOOLEAN = 'boolean',
	/** @deprecated use INT/FLOAT instead */
	NUMBER = 'float',
	FLOAT = 'float',
	INT = 'int',
	TABLE = 'table',
	OBJECT = 'object',
	ENUM = 'enum',
}

export type ConfigManifestEntry =
	| ConfigManifestEntryDefault
	| TableConfigManifestEntry
	| ConfigManifestEnumEntry
	| ConfigManifestIntEntry
	| ConfigManifestFloatEntry
export interface ConfigManifestEntryBase {
	id: string
	name: string
	type: ConfigManifestEntryType
	values?: any // for enum
	placeholder?: string
	hint?: string
}
export interface ConfigManifestEnumEntry extends ConfigManifestEntryBase {
	type: ConfigManifestEntryType.ENUM
	values: any // for enum
}
export interface ConfigManifestEntryDefault extends ConfigManifestEntryBase {
	type: Exclude<
		ConfigManifestEntryType,
		| ConfigManifestEntryType.ENUM
		| ConfigManifestEntryType.INT
		| ConfigManifestEntryType.FLOAT
		| ConfigManifestEntryType.TABLE
	>
}
export interface ConfigManifestIntEntry extends ConfigManifestEntryBase {
	type: ConfigManifestEntryType.INT
	/** Zero-based values will be stored in the database (and reported to blueprints) as values starting from 0, however,
	 * 	when rendered in settings pages they will appear as value + 1
	 */
	zeroBased?: boolean
}
export interface ConfigManifestFloatEntry extends ConfigManifestEntryBase {
	type: ConfigManifestEntryType.FLOAT
}
export interface ConfigManifestEnumEntry extends ConfigManifestEntryBase {
	type: ConfigManifestEntryType.ENUM
	values: any // for enum
}
export interface TableEntryBaseConfigManifestEntry extends ConfigManifestEntryBase {
	columnName?: string
	columnEditable?: boolean // TODO - not yet implemented.
	defaultVal?: any
}
export type TableEntryConfigManifestEntry = TableEntryBaseConfigManifestEntry & ConfigManifestEntry

export interface TableConfigManifestEntry extends ConfigManifestEntryBase {
	/** Whether this follows the deviceId logic for updating */
	isSubDevices?: boolean
	/** The default name/id for any new devices */
	subDeviceDefaultName?: string
	/** The type any new entry gets by default */
	defaultType: string
	type: ConfigManifestEntryType.TABLE
	/** Used when the .config indexes are different from the type enum */
	deviceTypesMapping?: any
	/** The name of the the property used to decide the type of the entry */
	typeField?: string
	/** Only one type means that the type option will not be present. When using this as a subDevice configuration object,
	 * a property of type BOOLEAN and id `disable` has special meaning and can be operated on outside of the GUI
	 */
	config: { [type: string]: TableEntryConfigManifestEntry[] }
}

export type MappingsManifest = Record<string, MappingManifestEntry[]>

export interface MappingManifestEntryProps {
	optional?: boolean
	includeInSummary?: boolean
}

export type MappingManifestEntry = MappingManifestEntryProps &
	(ConfigManifestEntryDefault | ConfigManifestEnumEntry | ConfigManifestIntEntry | ConfigManifestFloatEntry)
