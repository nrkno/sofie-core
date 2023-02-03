import { BasicConfigItemValue } from './common'
import { SourceLayerType } from './content'
import { TSR } from './timeline'

export enum ConfigManifestEntryType {
	STRING = 'string',
	MULTILINE_STRING = 'multiline_string',
	INT = 'int',
	FLOAT = 'float',
	BOOLEAN = 'boolean',
	ENUM = 'enum',
	TABLE = 'table',
	SELECT = 'select',
	SOURCE_LAYERS = 'source_layers',
	LAYER_MAPPINGS = 'layer_mappings',
	SELECT_FROM_COLUMN = 'select_from_column',
	JSON = 'json',
}

export type BasicConfigManifestEntry =
	| ConfigManifestEntryString
	| ConfigManifestEntryMultilineString
	| ConfigManifestEntryInt
	| ConfigManifestEntryFloat
	| ConfigManifestEntryBoolean
	| ConfigManifestEntryEnum
	| ConfigManifestEntrySelectFromOptions<true>
	| ConfigManifestEntrySelectFromOptions<false>
	| ConfigManifestEntrySelectFromColumn<true>
	| ConfigManifestEntrySelectFromColumn<false>
	| ConfigManifestEntrySourceLayers<true>
	| ConfigManifestEntrySourceLayers<false>
	| ConfigManifestEntryLayerMappings<true>
	| ConfigManifestEntryLayerMappings<false>
	| ConfigManifestEntryJson

export type ConfigManifestEntry = BasicConfigManifestEntry | ConfigManifestEntryTable

export interface ConfigManifestEntryBase {
	id: string
	name: string
	description: string
	type: ConfigManifestEntryType
	required: boolean
	hint?: string
}
export interface ConfigManifestEntryString extends ConfigManifestEntryBase {
	type: ConfigManifestEntryType.STRING
}

/** Text area, each line entered is a string in an array */
export interface ConfigManifestEntryMultilineString extends ConfigManifestEntryBase {
	type: ConfigManifestEntryType.MULTILINE_STRING
}
export interface ConfigManifestEntryInt extends ConfigManifestEntryBase {
	type: ConfigManifestEntryType.INT
	/** Zero-based values will be stored in the database (and reported to blueprints) as values starting from 0, however,
	 * 	when rendered in settings pages they will appear as value + 1
	 */
	zeroBased?: boolean
}
export interface ConfigManifestEntryFloat extends ConfigManifestEntryBase {
	type: ConfigManifestEntryType.FLOAT
}
export interface ConfigManifestEntryBoolean extends ConfigManifestEntryBase {
	type: ConfigManifestEntryType.BOOLEAN
}
export interface ConfigManifestEntryEnum extends ConfigManifestEntryBase {
	type: ConfigManifestEntryType.ENUM
	options: string[]
}
export interface ConfigManifestEntryJson extends ConfigManifestEntryBase {
	type: ConfigManifestEntryType.JSON
}
export interface ConfigManifestEntryTable extends ConfigManifestEntryBase {
	type: ConfigManifestEntryType.TABLE
	columns: (BasicConfigManifestEntry & {
		/** Column rank (left to right, lowest to highest) */
		rank: number
		/** Default value of the column for newly inserted rows */
		defaultVal: BasicConfigItemValue
	})[]
}

interface ConfigManifestEntrySelectBase<Multiple extends boolean> extends ConfigManifestEntryBase {
	multiple: Multiple
}

export interface ConfigManifestEntrySelectFromOptions<Multiple extends boolean>
	extends ConfigManifestEntrySelectBase<Multiple> {
	type: ConfigManifestEntryType.SELECT
	options: string[]
}

export interface ConfigManifestEntrySelectFromColumn<Multiple extends boolean>
	extends ConfigManifestEntrySelectBase<Multiple> {
	type: ConfigManifestEntryType.SELECT_FROM_COLUMN
	/** The id of a ConfigManifestEntryTable in the same config manifest */
	tableId: string
	/** The id of a BasicConfigManifestEntry in the table */
	columnId: string
}

export interface ConfigManifestEntrySourceLayers<Multiple extends boolean>
	extends ConfigManifestEntrySelectBase<Multiple> {
	type: ConfigManifestEntryType.SOURCE_LAYERS
	filters?: {
		sourceLayerTypes?: SourceLayerType[]
	}
}
export interface ConfigManifestEntryLayerMappings<Multiple extends boolean>
	extends ConfigManifestEntrySelectBase<Multiple> {
	type: ConfigManifestEntryType.LAYER_MAPPINGS
	filters?: {
		deviceTypes?: TSR.DeviceType[]
	}
}
