// @todo: these typings are duplicates from the integration


export interface DeviceConfigManifest {
	deviceConfig: ConfigManifestEntry[]
	deviceOAuthFlow?: DeviceOAuthFlow
}

export interface SubDeviceConfigManifest {
	defaultType: string
	config: { [type: string]: SubDeviceConfigManifestEntry[] | ConfigManifestEntry[] }
}

export interface DeviceOAuthFlow {
	credentialsHelp: string
	credentialsURL: string
}


export enum ConfigManifestEntryType {
	LABEL = 'label',
	LINK = 'link',
	STRING = 'string',
	BOOLEAN = 'boolean',
	NUMBER = 'float',
	FLOAT = 'float',
	INT = 'int',
	TABLE = 'table',
	OBJECT = 'object',
	ENUM = 'enum' // @todo: implement
}

export type ConfigManifestEntry = ConfigManifestEntryBase | TableConfigManifestEntry | ConfigManifestEnumEntry | SubDeviceConfigManifestEntry
export interface ConfigManifestEntryBase {
	id: string
	name: string
	type: ConfigManifestEntryType
	values?: any // for enum
	placeholder?: string
}
export interface ConfigManifestEnumEntry extends ConfigManifestEntryBase {
	type: ConfigManifestEntryType.ENUM
	values: any // for enum
}
export interface SubDeviceConfigManifestEntry extends ConfigManifestEntryBase {
	columnName?: string
	columnEditable?: boolean
	defaultVal?: any // TODO - is this wanted?
}

export interface TableConfigManifestEntry extends ConfigManifestEntryBase {
	/** Whether this follows the deviceId logic for updating */
	isSubDevices?: boolean
	subDeviceDefaultName?: string
	defaultType?: string
	type: ConfigManifestEntryType.TABLE
	deviceTypesMapping?: any
	typeField?: string
	/** Only one type means that the option will not be present */
	config: { [type: string]: ConfigManifestEntry[] }
}
