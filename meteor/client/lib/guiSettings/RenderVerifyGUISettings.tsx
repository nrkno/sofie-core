import React from 'react'
import { GUISetting, GUISettingId, GUISettingSection, GUISettingsType } from './guiSettings'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'

export const RenderVerifyGUISettings: React.FC<{
	getSettings: () => (GUISetting | GUISettingSection)[]
}> = ({ getSettings }) => {
	const uniqueIds = new Set<GUISettingId>()

	return <VerifyGUISettings getSettings={getSettings} uniqueIds={uniqueIds} />
}

const VerifyGUISettings: React.FC<{
	uniqueIds: Set<GUISettingId>
	getSettings: () => (GUISetting | GUISettingSection)[]
}> = ({ uniqueIds, getSettings }) => {
	const settings = getSettings()
	return (
		<>
			{settings.map((setting) => {
				// Check that IDs are unique:
				if (uniqueIds.has(setting.id)) {
					return (
						<div
							key={unprotectString(setting.id)}
							className="gui-settings-verify-warning"
						>{`Duplicate GUISetting ID: ${setting.id}`}</div>
					)
				}
				uniqueIds.add(setting.id)

				// Check children:
				if (setting.type === GUISettingsType.SECTION) {
					return (
						<VerifyGUISettings key={unprotectString(setting.id)} getSettings={setting.getList} uniqueIds={uniqueIds} />
					)
				} else return null
			})}
		</>
	)
}
