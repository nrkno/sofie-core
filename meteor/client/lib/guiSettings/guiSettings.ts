import { ProtectedString, protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import React from 'react'

export interface GUISettings {
	list: (GUISetting<any> | GUISettingSection)[]
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
	getList: () => GUISettingSectionList
	/** @returns component to display when section is folded/closed in GUI */
	renderSummary?: React.FC<{}>
}
export interface GUISettingSectionList {
	/** @returns a warning if there is an issue with the list, otherwise falsy */
	warning?: string | undefined | null | false
	list: (GUISetting<any> | GUISettingSection)[]
}

export interface GUISetting<PROPS> extends GUISettingBase {
	type: GUISettingsType.SETTING
	/** When true, don't display name & description, just the content */
	transparent?: boolean
	/** @returns the component to use to render the setting */
	render: ((props: PROPS) => JSX.Element) | React.Component<PROPS> | React.FC<PROPS>
	/** properties that will be fed into the render function */
	renderProps: PROPS
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

export function getDeepLink(settingId: GUISettingId, contextBaseUrl: string): string {
	return `${contextBaseUrl}/${settingId}`
}
export interface GUIRenderContext {
	/** URL to base deep links on */
	baseURL: string
	/** URL for the "homepage */
	startURL: string
	gotoUrl: string | undefined
}

/** Convenience method to create a settings object and get strict typings in renderProps */
export function guiSetting<PROPS>(settingObj: GUISetting<PROPS>): GUISetting<PROPS> {
	return settingObj
}
