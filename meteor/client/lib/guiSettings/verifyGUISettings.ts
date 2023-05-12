import { GUISetting, GUISettingSection, GUISettings, GUISettingsType } from './guiSettings'

export function verifyGUISettings(settings: GUISettings): string | undefined {
	const uniqueIds = new Set<string>()

	for (const setting of settings.list) {
		const warning = verifyGUISetting(uniqueIds, setting)
		if (warning) return warning
	}
	return undefined
}
function verifyGUISetting(uniqueIds: Set<string>, setting: GUISetting | GUISettingSection): string | undefined {
	// Check that IDs are unique:
	if (uniqueIds.has(setting.id)) {
		return `Duplicate GUISetting ID: ${setting.id}`
	}
	uniqueIds.add(setting.id)

	// Check children:
	if (setting.type === GUISettingsType.SECTION) {
		for (const listSetting of setting.getList()) {
			const warning = verifyGUISetting(uniqueIds, listSetting)
			if (warning) return warning
		}
	}
	return undefined
}
