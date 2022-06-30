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

export interface SubDeviceConfigManifest {
	defaultType: string
	config: {
		[type: string]: ConfigManifestEntry[] // | SubDeviceConfigManifestEntry[]
	}
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
	FLOAT = 'float',
	INT = 'int',
	TABLE = 'table',
	OBJECT = 'object',
	ENUM = 'enum',
}

export type ConfigManifestEntry =
	// | ConfigManifestEntryBase
	| ConfigManifestEnumEntry
	| TableConfigManifestEntry
	| ConfigManifestIntEntry
	| ConfigManifestFloatEntry
	| ConfigManifestBooleanEntry
	| ConfigManifestStringEntry
	| ConfigManifestObjectEntry
	| ConfigManifestMultilineStringEntry
// | SubDeviceConfigManifestEntry

export interface ConfigManifestEntryBase {
	/** Unique id / Attribute to edit */
	id: string
	/** Short description */
	name: string
	type: ConfigManifestEntryType
	/** Used in enums */
	values?: any
	/** Short label to display when value is undefined (default value) */
	placeholder?: string
	/** Longer description */
	hint?: string
	defaultVal?: any
}
export interface ConfigManifestEnumEntry extends ConfigManifestEntryBase {
	type: ConfigManifestEntryType.ENUM
	values: any // for enum
	defaultVal?: any
}

export interface ConfigManifestBooleanEntry extends ConfigManifestEntryBase {
	type: ConfigManifestEntryType.BOOLEAN
	defaultVal?: boolean
}
export interface ConfigManifestStringEntry extends ConfigManifestEntryBase {
	type: ConfigManifestEntryType.STRING
	defaultVal?: string
}
export interface ConfigManifestObjectEntry extends ConfigManifestEntryBase {
	type: ConfigManifestEntryType.OBJECT
}
export interface ConfigManifestMultilineStringEntry extends ConfigManifestEntryBase {
	type: ConfigManifestEntryType.MULTILINE_STRING
	defaultVal?: string
}
export interface ConfigManifestIntEntry extends ConfigManifestEntryBase {
	type: ConfigManifestEntryType.INT
	defaultVal?: number
	/** Zero-based values will be stored in the database (and reported to blueprints) as values starting from 0, however,
	 * 	when rendered in settings pages they will appear as value + 1
	 */
	zeroBased?: boolean
}
export interface ConfigManifestFloatEntry extends ConfigManifestEntryBase {
	type: ConfigManifestEntryType.FLOAT
	defaultVal?: number
}
export interface ConfigManifestEnumEntry extends ConfigManifestEntryBase {
	type: ConfigManifestEntryType.ENUM
	values: any // for enum
}

export interface TableConfigManifestEntry extends ConfigManifestEntryBase {
	type: ConfigManifestEntryType.TABLE
	/** Whether this follows the deviceId logic for updating */
	isSubDevices?: boolean
	/** The default name/id for any new devices */
	subDeviceDefaultName?: string
	/** The type any new entry gets by default */
	defaultType: string
	/** Used when the .config indexes are different from the type enum */
	deviceTypesMapping?: any
	/** The name of the the property used to decide the type of the entry */
	typeField?: string
	/** Only one type means that the type option will not be present. When using this as a subDevice configuration object,
	 * a property of type BOOLEAN and id `disable` has special meaning and can be operated on outside of the GUI
	 */
	config: { [type: string]: TableEntryConfigManifestEntry[] }
}
export interface TableEntryBaseConfigManifestEntry {
	columnName?: string
	columnEditable?: boolean // TODO - not yet implemented.
}
export type SubDeviceConfigManifestEntry = ConfigManifestEntry
// export type TableEntryConfigManifestEntry = ConfigManifestEntry // TableEntryBaseConfigManifestEntry & ConfigManifestEntry
export type TableEntryConfigManifestEntry = TableEntryBaseConfigManifestEntry & ConfigManifestEntry // TableEntryBaseConfigManifestEntry & ConfigManifestEntry

export type MappingsManifest = Record<string | number, MappingManifestEntry[]>

export interface MappingManifestEntryProps {
	optional?: boolean
	includeInSummary?: boolean
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
export type MappingManifestEntry = MappingManifestEntryProps &
	(ConfigManifestEntryDefault | ConfigManifestEnumEntry | ConfigManifestIntEntry | ConfigManifestFloatEntry)
