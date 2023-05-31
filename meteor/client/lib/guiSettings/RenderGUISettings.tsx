import React, { useEffect, useRef, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { RenderVerifyGUISettings } from './RenderVerifyGUISettings'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { mapAndFilter, unprotectString } from '../../../lib/lib'
import { defaultEditAttributeProps } from './lib'
import {
	GUIRenderContext,
	GUISetting,
	GUISettingId,
	GUISettingSection,
	GUISettings,
	GUISettingsType,
	getDeepLink,
	guiSettingIdIncludes,
} from './guiSettings'
import { TextInputControl } from '../Components/TextInput'
import classNames from 'classnames'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { useSession } from '../ReactMeteorData/ReactMeteorData'
import { RenderWarnings } from './RenderWarnings'

export const RenderGUISettings: React.FC<{ context: GUIRenderContext; settings: GUISettings }> =
	function RenderGUISettings({ settings, context }) {
		console.log('=======================================')
		console.log('RenderGUISettings')
		const history = useHistory()
		const [filterString, setFilterString] = useSession(`gui-settings_${context.baseURL}_filter`, '')
		useEffect(() => {
			// Set the filterString to what we got in the context (from a URL parameter):
			setFilterString(context.filterString ?? '')
		}, [context.filterString])

		// const [verifyWarning, setVerifyWarning] = useState<string | undefined>(undefined)

		// verifyGUISettings(settings)
		// getWarnings(settings.list)
		// const [warnings, setWarnings] = useState<{ settingId: GUISettingId; breadcrumbs: string[]; message: string }[]>([])

		// const filteredSettings = filterSettings(settings, filterString)

		const innerContext = literal<GUIInnerRenderContext>({
			...context,
			filterString: filterString,
		})

		return (
			<div className="gui-settings">
				<RenderVerifyGUISettings getSettings={() => settings.list} />

				<RenderWarnings
					context={innerContext}
					getSettings={() => settings.list}
					breadcrumbs={[]}
					onClick={(settingId: GUISettingId) => {
						history.push(getDeepLink(settingId, context))
						// Also set the filter string, in case we're already at that url:
						setFilterString(unprotectString(settingId))
					}}
				/>

				{/* {warnings.length > 0 && (
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
				)} */}

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

				<RenderListItemList
					context={innerContext}
					getSettings={() => settings.list}
					isOuter={true}
					callbackFilterDisplay={() => {
						// nothing
					}}
				/>
			</div>
		)
	}

const RenderListItemList: React.FC<{
	context: GUIInnerRenderContext
	getSettings: () => (GUISetting | GUISettingSection)[]
	isOuter?: boolean
	callbackFilterDisplay: (settingId: GUISettingId, isDisplayed: boolean) => void
}> = function RenderListItemList({ context, getSettings, isOuter, callbackFilterDisplay }) {
	const settings = getSettings()
	return (
		<div className={classNames('gui-settings-list', isOuter && 'outer')}>
			{settings.map((setting) => {
				return (
					<RenderListItem
						key={unprotectString(setting.id)}
						context={context}
						setting={setting}
						callbackFilterDisplay={callbackFilterDisplay}
					/>
				)
			})}
		</div>
	)
}
const RenderListItem: React.FC<{
	context: GUIInnerRenderContext
	setting: GUISetting | GUISettingSection
	callbackFilterDisplay: (settingId: GUISettingId, isDisplayed: boolean) => void
}> = function RenderListItem({ context, setting, callbackFilterDisplay }) {
	// console.log('item', setting.id)
	const [sectionCollapsed, setSectionCollapsed] = useSession(
		`guiSettings_${context.baseURL}_${setting.id}_collapsed`,
		false
	)

	const displayChildIds = useRef<Set<GUISettingId>>(new Set())
	const [_displayChildIdsUpdate, setDisplayChildIdsUpdate] = useState<number>(0)

	useEffect(() => {
		// When the filter changes, clear displayChildIds
		displayChildIds.current.clear()
		setDisplayChildIdsUpdate(Date.now())
	}, [context.filterString])

	const display = filterDisplaySetting(setting, context) || displayChildIds.current.size > 0
	// console.log('    ', filterDisplaySetting(setting, context), Array.from(displayChildIds.current.values()))

	useEffect(() => {
		if (sectionCollapsed && context.filterString) {
			if (guiSettingIdIncludes(setting.id, context.filterString) || displayChildIds.current.size > 0) {
				setSectionCollapsed(false)
			}
		}
	}, [setting.id, sectionCollapsed, context.filterString])

	callbackFilterDisplay(setting.id, display)

	if (setting.type === GUISettingsType.SECTION) {
		// Note: if setting.renderSummary is set, the section can be collapsed
		const isCollapsed = Boolean(setting.renderSummary && sectionCollapsed)

		return (
			<div
				className={classNames('gui-settings-list__item', {
					'filter-hidden': !display,
				})}
			>
				<div
					className={classNames('gui-settings-section', {
						collapsed: isCollapsed,
					})}
				>
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
					<RenderListItemList
						context={context}
						getSettings={setting.getList}
						callbackFilterDisplay={(settingId, isDisplayed) => {
							let hasUpdated = false
							if (isDisplayed) {
								if (!displayChildIds.current.has(settingId)) {
									displayChildIds.current.add(settingId)
									hasUpdated = true
								}
							} else {
								if (displayChildIds.current.has(settingId)) {
									displayChildIds.current.delete(settingId)
									hasUpdated = true
								}
							}
							if (hasUpdated) {
								setTimeout(() => {
									setDisplayChildIdsUpdate(Date.now())
								}, 1)
							}
						}}
					/>
					{setting.renderSummary && isCollapsed && <setting.renderSummary />}
				</div>
			</div>
		)
	} else {
		if (!display) return null

		const warning = setting.getWarning?.()
		return (
			<div className="gui-settings-list__item">
				<div className="gui-settings-setting">
					<h2 className="name">{setting.name}</h2>
					<div className="description">{setting.description}</div>
					{warning && <div className="warning">{warning}</div>}
					<div className="content">
						<setting.render />
					</div>
				</div>
			</div>
		)
	}
}
function filterDisplaySetting(setting: GUISetting | GUISettingSection, context: GUIInnerRenderContext): boolean {
	let useSetting = false

	// Match name:
	if (scatterMatchString(setting.name, context.filterString) !== null) {
		useSetting = true
	}
	// Match description:
	if (!useSetting && setting.description && scatterMatchString(setting.description, context.filterString) !== null) {
		useSetting = true
	}
	// Match id:
	if (!useSetting && scatterMatchString(setting.id, context.filterString) !== null) {
		useSetting = true
	}
	// Match getSearchString:
	if (!useSetting) {
		const searchString: string =
			typeof setting.getSearchString === 'string' ? setting.getSearchString : setting.getSearchString()
		if (scatterMatchString(searchString, context.filterString) !== null) {
			useSetting = true
		}
	}

	return useSetting
}

interface GUIInnerRenderContext extends GUIRenderContext {
	filterString: string
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
