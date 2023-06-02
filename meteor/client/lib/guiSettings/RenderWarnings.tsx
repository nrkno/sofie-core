import React from 'react'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	GUIRenderContext,
	GUISetting,
	GUISettingId,
	GUISettingSection,
	GUISettingsType,
	getDeepLink,
} from './guiSettings'

/**
 * Iterates deep through the settings and renders the warnings therein
 */
export const RenderWarnings: React.FC<{
	context: GUIRenderContext
	getSettings: () => (GUISetting<any> | GUISettingSection)[]
	breadcrumbs: string[]
	onClick: (settingId: GUISettingId) => void
}> = ({ context, getSettings, breadcrumbs, onClick }) => {
	const settings = getSettings()

	return (
		<>
			{settings.map((setting) => {
				const innerBreadcrumbs = [...breadcrumbs, setting.name]
				if (setting.type === GUISettingsType.SECTION) {
					return (
						<RenderWarnings
							key={unprotectString(setting.id)}
							context={context}
							getSettings={setting.getList}
							breadcrumbs={innerBreadcrumbs}
							onClick={onClick}
						/>
					)
				} else if (setting.type === GUISettingsType.SETTING) {
					const warningMessage = setting.getWarning && setting.getWarning()
					if (warningMessage) {
						return (
							<a
								key={unprotectString(setting.id)}
								className="gui-settings-warnings"
								href={getDeepLink(setting.id, context.baseURL)}
								onClick={(e) => {
									e.preventDefault()
									onClick(setting.id)
								}}
							>
								<span className="label">{innerBreadcrumbs.join('>')}</span>:&nbsp;
								<span className="message">{warningMessage}</span>
							</a>
						)
					}
				} else {
					assertNever(setting)
					return null
				}
			})}
		</>
	)
}
