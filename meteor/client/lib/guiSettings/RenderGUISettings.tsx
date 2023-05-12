import React from 'react'
import { verifyGUISettings } from './verifyGUISettings'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { mapAndFilter } from '../../../lib/lib'
import { defaultEditAttributeProps } from './lib'
import { GUISetting, GUISettingBase, GUISettingSection, GUISettings, GUISettingsType } from './guiSettings'
import { TextInputControl } from '../Components/TextInput'

export const RenderGUISettings: React.FC<{ context: GUIRenderContext; settings: GUISettings }> =
	function RenderGUISettings({ settings, context }) {
		const [filterString, setFilterString] = React.useState('')

		const verifyWarning = verifyGUISettings(settings)

		const filteredSettings = filterSettings(settings, filterString)

		return (
			<div className="gui-settings">
				<div className="gui-settings-filter">
					<TextInputControl
						{...defaultEditAttributeProps}
						classNames="input text-input input-l"
						// placeholder={schema.default}
						value={filterString}
						handleUpdate={(newValue) => {
							setFilterString(newValue)
						}}
						updateOnKey={true}
					/>

					{/* <EditAttribute type="text" value={filterString}  /> */}
				</div>

				{verifyWarning && <div className="gui-settings-warning">{verifyWarning}</div>}

				<RenderListItemList context={context} settings={filteredSettings.list} />
			</div>
		)
	}
interface GUIRenderContext {
	baseURL: string
}

const RenderListItemList: React.FC<{
	context: GUIRenderContext
	settings: (GUISetting | GUISettingSection)[]
}> = function RenderListItemList({ context, settings }) {
	return (
		<div className="gui-settings-list">
			{settings.map((setting) => (
				<div className="gui-settings-list__item" key={setting.id}>
					<RenderListItem context={context} setting={setting} />
				</div>
			))}
		</div>
	)
}
const RenderListItem: React.FC<{ context: GUIRenderContext; setting: GUISetting | GUISettingSection }> =
	function RenderListItem({ context, setting }) {
		if (setting.type === GUISettingsType.SECTION) {
			return (
				<div className="gui-settings-section">
					<h2 className="name">
						<a href={getDeepLink(setting, context)}>{setting.name}</a>
					</h2>
					<div className="description">{setting.description}</div>
					<RenderListItemList context={context} settings={setting.getList()} />
				</div>
			)
		} else {
			const warning = setting.getWarning?.()
			return (
				<div className="gui-settings-setting">
					<h2 className="name">{setting.name}</h2>
					<div className="description">{setting.description}</div>
					{warning && <div className="warning">{warning}</div>}
					<div className="content">
						<setting.render />
					</div>
				</div>
			)
		}
	}
function filterSettings(settings: GUISettings, filterString: string): GUISettings {
	if (filterString === '') return settings

	const filteredSettings: GUISettings = {
		list: mapAndFilter(settings.list, (setting) => filterSetting(setting, filterString)),
	}

	return filteredSettings
}
function filterSetting(
	setting: GUISetting | GUISettingSection,
	filterString: string
): GUISetting | GUISettingSection | undefined {
	let useSetting = false

	if (scatterMatchString(setting.name, filterString) !== null) {
		useSetting = true
	}
	if (!useSetting && setting.description && scatterMatchString(setting.description, filterString) !== null) {
		useSetting = true
	}
	if (!useSetting && scatterMatchString(setting.id, filterString) !== null) {
		useSetting = true
	}
	if (!useSetting) {
		const searchString: string =
			typeof setting.getSearchString === 'string' ? setting.getSearchString : setting.getSearchString()
		if (scatterMatchString(searchString, filterString) !== null) {
			useSetting = true
		}
	}

	if (setting.type === GUISettingsType.SECTION) {
		const settingsList = mapAndFilter(setting.getList(), (listSetting) => filterSetting(listSetting, filterString))

		if (settingsList.length > 0) useSetting = true
		if (!useSetting) return undefined

		return literal<GUISettingSection>({
			...setting,
			getList: () => {
				return settingsList
			},
		})
	} else {
		if (!useSetting) return undefined
		return setting
	}

	return setting
}

function getDeepLink(setting: GUISettingBase, context: GUIRenderContext): string {
	return `${context.baseURL}/${setting.id}`
}

/** Returns a number it the search is somewhere in source, for example "johny" matches "Johan Nyman", or null if it's not found */
export function scatterMatchString(source: string, search: string): null | number {
	search = search.toLowerCase()
	source = source.toLowerCase()

	let j = 0
	for (const char of search) {
		const foundIndex = source.indexOf(char, j)

		if (foundIndex === -1) {
			// no match
			return null
		} else {
			j = foundIndex + 1
		}
	}
	return j
}
