export enum ConfigManifestEntryType {
	STRING = 'string',
	MULTILINE_STRING = 'multiline_string',
	INT = 'int',
	FLOAT = 'float',
	BOOLEAN = 'boolean',
	ENUM = 'enum',
}

export type BasicConfigManifestEntry =
	| ConfigManifestEntryString
	| ConfigManifestEntryMultilineString
	| ConfigManifestEntryInt
	| ConfigManifestEntryFloat
	| ConfigManifestEntryBoolean
	| ConfigManifestEntryEnum

export type ConfigManifestEntry = BasicConfigManifestEntry

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
