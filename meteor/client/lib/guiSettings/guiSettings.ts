export interface GUISettings {
	list: (GUISetting | GUISettingSection)[]
}
export enum GUISettingsType {
	SECTION = 'section',
	SETTING = 'setting',
}
export interface GUISettingBase {
	type: GUISettingsType
	name: string
	description?: string
	/**
	 * Globally unique identifier, used to deep-link to a certain setting.
	 * Must be on the form: "my/deep/link"
	 */
	id: string
	/** @returns a string, used when filtering. Normally contains displayed and non-displayed data, such as current-value, options etc.. */
	getSearchString: string | (() => string)
}
export interface GUISettingSection extends GUISettingBase {
	type: GUISettingsType.SECTION
	getList: () => (GUISetting | GUISettingSection)[]
	/** @returns component to display when section is folded/closed in GUI */
	renderSummary?: React.FC<{}>
}

export interface GUISetting extends GUISettingBase {
	type: GUISettingsType.SETTING
	/** @returns the component to use to render the setting */
	render: React.FC<{}>
	/** @returns a warning if there is an issue with the setting, otherwise falsy */
	getWarning?: () => string | undefined | null | false
}
