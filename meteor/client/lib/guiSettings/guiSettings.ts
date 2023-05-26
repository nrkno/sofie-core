import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { ProtectedString, protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'

export interface GUISettings {
	list: (GUISetting | GUISettingSection)[]
}
export enum GUISettingsType {
	SECTION = 'section',
	SETTING = 'setting',
}
export type GUISettingId = ProtectedString<'GUISettingId'>
export interface GUISettingBase {
	type: GUISettingsType
	name: string
	description?: string
	/**
	 * Globally unique identifier, used to deep-link to a certain setting.
	 * Must be on the form: "my/deep/link"
	 */
	id: GUISettingId
	/**
	 * Used to provide additional context when filtering for settings.
	 * @returns a string, used when filtering. Normally contains displayed and non-displayed data, such as current-value, options etc..
	 */
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

export function guiSettingId(baseUrl: string | GUISettingId, ...urls: string[]): GUISettingId {
	return protectString([baseUrl, ...urls].join('/'))
}
export function guiSettingIdIncludes(settingId: GUISettingId, search: string): boolean {
	if (search.length === 0) return false

	const settingIdStr = unprotectString(settingId)
	if (settingIdStr.startsWith(search)) return true
	if (search.startsWith(settingIdStr)) return true
	return false
}

/**
 * Iterates deep through the settings, and returns a list of warnings.
 */
export function getWarnings(
	settings: (GUISetting | GUISettingSection)[],
	breadcrumbs: string[] = []
): {
	settingId: GUISettingId
	breadcrumbs: string[]
	message: string
}[] {
	const warnings: {
		settingId: GUISettingId
		breadcrumbs: string[]
		message: string
	}[] = []

	for (const setting of settings) {
		const innerBreadcrumbs = [...breadcrumbs, setting.name]
		if (setting.type === GUISettingsType.SECTION) {
			for (const warning of getWarnings(setting.getList(), innerBreadcrumbs)) {
				warnings.push(warning)
			}
		} else if (setting.type === GUISettingsType.SETTING) {
			const warningMessage = setting.getWarning && setting.getWarning()
			if (warningMessage) {
				warnings.push({
					settingId: setting.id,
					breadcrumbs: innerBreadcrumbs,
					message: warningMessage,
				})
			}
		} else {
			assertNever(setting)
		}
	}
	return warnings
}
