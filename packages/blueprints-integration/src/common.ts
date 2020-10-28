export type Time = number

export interface IBlueprintConfig {
	[key: string]: ConfigItemValue
}

export type ConfigItemValue = BasicConfigItemValue | TableConfigItemValue | IBlueprintConfig
export type TableConfigItemValue = {
	_id: string
	[key: string]: BasicConfigItemValue
}[]
export type BasicConfigItemValue = string | number | boolean | string[]
