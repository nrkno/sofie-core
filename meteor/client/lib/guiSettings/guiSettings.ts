export interface GUISettings {
	list: (GUISetting | GUISettingSection)[]
}
export interface GUISettingSection {
	type: 'section'

	name: string
	description: string

	getList: () => (GUISetting | GUISettingSection)[]
	renderSummary?: () => JSX.Element
}
export interface GUISetting {
	type: 'setting'
	name: string
	description: string
	url: string

	render: () => JSX.Element
}
