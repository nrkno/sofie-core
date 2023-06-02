import React from 'react'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { GUIRenderContext, GUISettingId, GUISettingSectionList, GUISettingsType, getDeepLink } from './guiSettings'

/**
 * Iterates deep through the settings and renders the warnings therein
 */
export const RenderWarnings: React.FC<{
	context: GUIRenderContext
	settingId: GUISettingId | null
	getList: () => GUISettingSectionList
	breadcrumbs: string[]
	onClick: (settingId: GUISettingId) => void
}> = ({ context, settingId, getList, breadcrumbs, onClick }) => {
	const settings = getList()

	return (
		<>
			{settingId && settings.warning && (
				<Warning
					context={context}
					settingId={settingId}
					breadcrumbs={breadcrumbs}
					warningMessage={settings.warning}
					onClick={onClick}
				/>
			)}
			{settings.list.map((setting) => {
				const innerBreadcrumbs = [...breadcrumbs, setting.name]
				if (setting.type === GUISettingsType.SECTION) {
					return (
						<RenderWarnings
							key={unprotectString(setting.id)}
							context={context}
							settingId={setting.id}
							getList={setting.getList}
							breadcrumbs={innerBreadcrumbs}
							onClick={onClick}
						/>
					)
				} else if (setting.type === GUISettingsType.SETTING) {
					const warningMessage = setting.getWarning && setting.getWarning()
					if (warningMessage) {
						return (
							<Warning
								key={unprotectString(setting.id)}
								context={context}
								settingId={setting.id}
								breadcrumbs={innerBreadcrumbs}
								warningMessage={warningMessage}
								onClick={onClick}
							/>
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

const Warning: React.FC<{
	context: GUIRenderContext
	settingId: GUISettingId
	breadcrumbs: string[]
	warningMessage: string
	onClick: (settingId: GUISettingId) => void
}> = ({ context, settingId, breadcrumbs, warningMessage, onClick }) => {
	return (
		<a
			className="gui-settings-warnings"
			href={getDeepLink(settingId, context.baseURL)}
			onClick={(e) => {
				e.preventDefault()
				onClick(settingId)
			}}
		>
			<span className="label">{breadcrumbs.join('>')}</span>:&nbsp;
			<span className="message">{warningMessage}</span>
		</a>
	)
}
