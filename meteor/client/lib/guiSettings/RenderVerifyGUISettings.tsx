import React from 'react'
import { GUISettingId, GUISettingSectionList, GUISettingsType } from './guiSettings'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'

export const RenderVerifyGUISettings: React.FC<{
	getList: () => GUISettingSectionList
}> = ({ getList }) => {
	const uniqueIds = new Set<GUISettingId>()

	return <VerifyGUISettings getList={getList} uniqueIds={uniqueIds} />
}

const VerifyGUISettings: React.FC<{
	uniqueIds: Set<GUISettingId>
	getList: () => GUISettingSectionList
}> = ({ uniqueIds, getList }) => {
	const settings = getList()
	return (
		<>
			{settings.list.map((setting) => {
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
					return <VerifyGUISettings key={unprotectString(setting.id)} getList={setting.getList} uniqueIds={uniqueIds} />
				} else return null
			})}
		</>
	)
}
