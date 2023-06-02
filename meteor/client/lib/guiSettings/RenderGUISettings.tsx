import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { RenderVerifyGUISettings } from './RenderVerifyGUISettings'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '../../../lib/lib'
import { defaultEditAttributeProps, useTrigger } from './lib'
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
import { faChevronDown, faChevronUp, faLink, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useSession } from '../ReactMeteorData/ReactMeteorData'
import { RenderWarnings } from './RenderWarnings'
import { SorensenContext } from '../SorensenContext'
import { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import Tooltip from 'rc-tooltip'

export const RenderGUISettings: React.FC<{ context: GUIRenderContext; settings: GUISettings }> =
	function RenderGUISettings({ settings, context }) {
		const history = useHistory()
		const { t } = useTranslation()
		const [filterString, setFilterString] = useSession(`gui-settings_${context.baseURL}_filter`, '')

		const goToLink = useCallback(
			(settingId: GUISettingId | null) => {
				if (settingId === null) {
					history.push(context.baseURL)
					setFilterString('')
				} else {
					history.push(getDeepLink(settingId, context.baseURL))
					// Also set the filter string, in case we're already at that url:
					setFilterString(unprotectString(settingId))
				}
			},
			[history]
		)
		useEffect(() => {
			// Set the filterString to what we got in the context (from a URL parameter):
			setFilterString(context.filterString ?? '')
		}, [context.filterString])
		useEffect(() => {
			// When user clears the filterString, clear the deep-link url
			// (quality-of-life improvement)
			if (filterString === '' && context.filterString !== '') {
				goToLink(null)
			}
		}, [filterString, context.filterString])

		const innerContext = literal<GUIInnerRenderContext>({
			...context,
			filterString: filterString,
		})

		return (
			<div className="gui-settings">
				<RenderVerifyGUISettings getSettings={() => settings.list} />
				<RenderWarnings context={innerContext} getSettings={() => settings.list} breadcrumbs={[]} onClick={goToLink} />

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
					<button className="btn btn-default clear-button" onClick={() => setFilterString('')}>
						<FontAwesomeIcon icon={faXmark} />
					</button>
				</div>

				<RenderListItemList
					t={t}
					context={innerContext}
					getSettings={() => settings.list}
					isOuter={true}
					callbackFilterDisplay={() => {
						// nothing
					}}
					onClickLink={goToLink}
				/>
			</div>
		)
	}

const RenderListItemList: React.FC<{
	t: TFunction
	context: GUIInnerRenderContext
	getSettings: () => (GUISetting<any> | GUISettingSection)[]
	isOuter?: boolean
	callbackFilterDisplay: (settingId: GUISettingId, isDisplayed: boolean) => void
	onClickLink: (settingId: GUISettingId) => void
}> = function RenderListItemList({ t, context, getSettings, isOuter, callbackFilterDisplay, onClickLink }) {
	const settings = getSettings()

	const [expandCollapse, triggerExpandCollapse] = useTrigger(false)

	const onExpandCollapseAll = useCallback((collapse: boolean) => {
		triggerExpandCollapse(collapse)
	}, [])

	return (
		<div className={classNames('gui-settings-list', isOuter && 'outer')}>
			{settings.map((setting) => {
				return (
					<RenderListItem
						key={unprotectString(setting.id)}
						t={t}
						context={context}
						setting={setting}
						callbackFilterDisplay={callbackFilterDisplay}
						onClickLink={onClickLink}
						expandCollapse={expandCollapse}
						onExpandCollapseAll={onExpandCollapseAll}
					/>
				)
			})}
		</div>
	)
}
const RenderListItem: React.FC<{
	t: TFunction
	context: GUIInnerRenderContext
	setting: GUISetting<any> | GUISettingSection
	callbackFilterDisplay: (settingId: GUISettingId, isDisplayed: boolean) => void
	onClickLink: (settingId: GUISettingId) => void
	expandCollapse: boolean | undefined
	onExpandCollapseAll: (collapse: boolean) => void
}> = function RenderListItem({
	t,
	context,
	setting,
	callbackFilterDisplay,
	onClickLink,
	expandCollapse,
	onExpandCollapseAll,
}) {
	const sorensen = useContext(SorensenContext)
	const [sectionCollapsed, setSectionCollapsed] = useSession(
		`guiSettings_${context.baseURL}_${setting.id}_collapsed`,
		false
	)
	useEffect(() => {
		if (expandCollapse !== undefined) {
			setSectionCollapsed(expandCollapse)
		}
	}, [expandCollapse])

	const displayChildIds = useRef<Set<GUISettingId>>(new Set())
	const [_displayChildIdsUpdate, setDisplayChildIdsUpdate] = useState<number>(0)

	useEffect(() => {
		// When the filter changes, clear displayChildIds
		displayChildIds.current.clear()
		setDisplayChildIdsUpdate(Date.now())
	}, [context.filterString])

	const display = filterDisplaySetting(setting, context) || displayChildIds.current.size > 0

	useEffect(() => {
		if (sectionCollapsed && context.filterString) {
			if (guiSettingIdIncludes(setting.id, context.filterString) || displayChildIds.current.size > 0) {
				setSectionCollapsed(false)
			}
		}
	}, [setting.id, sectionCollapsed, context.filterString])

	const handleToggleSectionCollapsed = useCallback(() => {
		const newValue = !sectionCollapsed
		console.log(sorensen?.getPressedKeys())
		if (sorensen?.getPressedKeys().find((key) => key.match(/alt/i))) {
			// Alt+click: collapse/expand all sections

			onExpandCollapseAll(newValue)
		} else {
			setSectionCollapsed(newValue)
		}
	}, [sectionCollapsed])

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
						expanded: !isCollapsed,
					})}
				>
					<div className="content">
						{setting.renderSummary && (
							<Tooltip
								overlay={
									(isCollapsed
										? t('Expand section (hold Alt to expand all)')
										: t('Collapse section (hold Alt to collapse all)')) as React.ReactNode
								}
							>
								<button
									className="collapse-section btn btn-tight btn-default"
									onClick={() => handleToggleSectionCollapsed()}
								>
									<FontAwesomeIcon icon={sectionCollapsed ? faChevronDown : faChevronUp} />
								</button>
							</Tooltip>
						)}
						<NameLink setting={setting} context={context} onClick={onClickLink} />
						<div className="description">{setting.description}</div>
					</div>
					<RenderListItemList
						t={t}
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
						onClickLink={onClickLink}
					/>
					{setting.renderSummary && isCollapsed && <setting.renderSummary />}
				</div>
			</div>
		)
	} else {
		if (!display) return null

		const RenderContent = setting.render as any

		const warning = setting.getWarning?.()
		return (
			<div className="gui-settings-list__item">
				<div className="gui-settings-setting">
					{!setting.transparent && (
						<>
							<NameLink setting={setting} context={context} onClick={onClickLink} />
							<div className="description">{setting.description}</div>
						</>
					)}

					{warning && <div className="warning">{warning}</div>}
					<div className="content">
						<RenderContent {...setting.renderProps} />
					</div>
				</div>
			</div>
		)
	}
}
function filterDisplaySetting(setting: GUISetting<any> | GUISettingSection, context: GUIInnerRenderContext): boolean {
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

const NameLink: React.FC<{
	setting: GUISetting<any> | GUISettingSection
	context: GUIInnerRenderContext
	onClick: (settingId: GUISettingId) => void
}> = ({ setting, context, onClick }) => {
	return (
		<h2 className="gui-settings__name">
			<a
				href={getDeepLink(setting.id, context.baseURL)}
				className="link-icon"
				onClick={(e) => {
					e.preventDefault()
					onClick(setting.id)
				}}
			>
				<FontAwesomeIcon icon={faLink} />
			</a>
			<span>{setting.name}</span>
		</h2>
	)
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
