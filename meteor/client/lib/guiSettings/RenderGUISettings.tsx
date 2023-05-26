import React, { useEffect } from 'react'
import { useHistory } from 'react-router-dom'
import { verifyGUISettings } from './verifyGUISettings'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { mapAndFilter, unprotectString } from '../../../lib/lib'
import { defaultEditAttributeProps } from './lib'
import {
	GUISetting,
	GUISettingId,
	GUISettingSection,
	GUISettings,
	GUISettingsType,
	getWarnings,
	guiSettingIdIncludes,
} from './guiSettings'
import { TextInputControl } from '../Components/TextInput'
import classNames from 'classnames'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { useSession } from '../ReactMeteorData/ReactMeteorData'
import { useTranslation } from 'react-i18next'

export const RenderGUISettings: React.FC<{ context: GUIRenderContext; settings: GUISettings }> =
	function RenderGUISettings({ settings, context }) {
		const { t } = useTranslation()
		const history = useHistory()
		const [filterString, setFilterString] = useSession(`gui-settings_${context.baseURL}_filter`, '')
		useEffect(() => {
			// Set the filterString to what we got in the context (from a URL parameter):
			setFilterString(context.filterString ?? '')
		}, [context.filterString])

		const verifyWarning = verifyGUISettings(settings)
		const warnings = getWarnings(settings.list)

		const filteredSettings = filterSettings(settings, filterString)

		const innerContext = literal<GUIInnerRenderContext>({
			...context,
			filterString: filterString,
		})

		return (
			<div className="gui-settings">
				{verifyWarning && <div className="gui-settings-verify-warning">{verifyWarning}</div>}

				{warnings.length > 0 && (
					<div className="gui-settings-warnings">
						<h3>{t('Warnings')}</h3>
						{warnings.map((warning) => {
							return (
								<a
									key={unprotectString(warning.settingId)}
									className="gui-settings-warnings"
									href={getDeepLink(warning.settingId, context)}
									onClick={(e) => {
										e.preventDefault()
										history.push(getDeepLink(warning.settingId, context))
										// Also set the filter string, in case we're already at that url:
										setFilterString(unprotectString(warning.settingId))
									}}
								>
									<span className="label">{warning.breadcrumbs.join('>')}</span>:&nbsp;
									<span className="message">{warning.message}</span>
								</a>
							)
						})}
					</div>
				)}

				<div className="gui-settings-filter">
					<TextInputControl
						{...defaultEditAttributeProps}
						classNames="input text-input input-l"
						placeholder="Filter settings..."
						value={filterString}
						handleUpdate={(newValue) => {
							setFilterString(newValue)
						}}
						updateOnKey={true}
					/>
				</div>

				<RenderListItemList context={innerContext} settings={filteredSettings.list} isOuter={true} />
			</div>
		)
	}

const RenderListItemList: React.FC<{
	context: GUIInnerRenderContext
	settings: (GUISetting | GUISettingSection)[]
	isOuter?: boolean
}> = function RenderListItemList({ context, settings, isOuter }) {
	return (
		<div className={classNames('gui-settings-list', isOuter && 'outer')}>
			{settings.map((setting) => (
				<div className="gui-settings-list__item" key={unprotectString(setting.id)}>
					<RenderListItem context={context} setting={setting} />
				</div>
			))}
		</div>
	)
}
const RenderListItem: React.FC<{ context: GUIInnerRenderContext; setting: GUISetting | GUISettingSection }> =
	function RenderListItem({ context, setting }) {
		const [sectionCollapsed, setSectionCollapsed] = useSession(
			`guiSettings_${context.baseURL}_${setting.id}_collapsed`,
			false
		)
		useEffect(() => {
			if (sectionCollapsed) {
				if (guiSettingIdIncludes(setting.id, context.filterString)) {
					setSectionCollapsed(false)
				}
			}
		}, [setting.id, sectionCollapsed, context.filterString])

		if (setting.type === GUISettingsType.SECTION) {
			// Note if setting.renderSummary is set, the section can be collapsed

			return (
				<div className="gui-settings-section">
					<div className="content">
						{setting.renderSummary && (
							<button
								className="collapse-section btn btn-tight btn-default"
								onClick={() => setSectionCollapsed((c) => !c)}
							>
								<FontAwesomeIcon icon={sectionCollapsed ? faChevronDown : faChevronUp} />
							</button>
						)}
						<h2 className="name">
							<a href={getDeepLink(setting.id, context)}>{setting.name}</a>
						</h2>
						<div className="description">{setting.description}</div>
					</div>
					{setting.renderSummary && sectionCollapsed ? (
						<setting.renderSummary />
					) : (
						<RenderListItemList context={context} settings={setting.getList()} />
					)}
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
export interface GUIRenderContext {
	baseURL: string
	filterString?: string
}
interface GUIInnerRenderContext extends GUIRenderContext {
	filterString: string
}
function getDeepLink(settingId: GUISettingId, context: GUIRenderContext): string {
	return `${context.baseURL}/${settingId}`
}

/** Returns a number it the search is somewhere in source, for example "johny" matches "Johan Nyman", or null if it's not found */
export function scatterMatchString(source: GUISettingId | string, search: string): null | number {
	search = search.toLowerCase()
	source = `${source}`.toLowerCase()

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
