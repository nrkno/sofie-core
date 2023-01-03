import { Settings } from '../../lib/Settings'
import { getUserRoles } from '../../lib/collections/Users'

enum LocalStorageProperty {
	STUDIO = 'studioMode',
	CONFIGURE = 'configureMode',
	DEVELOPER = 'developerMode',
	TESTING = 'testingMode',
	SPEAKING = 'speakingMode',
	SERVICE = 'serviceMode',
	SHELF_FOLLOWS_ON_AIR = 'shelfFollowsOnAir',
	SHOW_HIDDEN_SOURCE_LAYERS = 'showHiddenSourceLayers',
	IGNORE_PIECE_CONTENT_STATUS = 'ignorePieceContentStatus',
	UI_ZOOM_LEVEL = 'uiZoomLevel',
	HELP_MODE = 'helpMode',
	LOG_NOTIFICATIONS = 'logNotifications',
}

const GUI_FLAGS: {
	[key in LocalStorageProperty]?: string | null
} = {}

function localStorageGetCachedItem(key: LocalStorageProperty): string | null {
	const cacheHit = GUI_FLAGS[key]
	if (cacheHit !== undefined) {
		return cacheHit
	}

	const uncachedVal = localStorage.getItem(key)
	GUI_FLAGS[key] = uncachedVal
	return uncachedVal
}

function localStorageSetCachedItem(key: LocalStorageProperty, value: string): void {
	GUI_FLAGS[key] = value
	localStorage.setItem(key, value)
}
function localStorageUnsetCachedItem(key: LocalStorageProperty): void {
	GUI_FLAGS[key] = null
	localStorage.removeItem(key)
}

export function setAllowStudio(studioMode: boolean) {
	localStorageSetCachedItem(LocalStorageProperty.STUDIO, studioMode ? '1' : '0')
}
export function getAllowStudio(): boolean {
	if (Settings.enableUserAccounts) {
		return !!getUserRoles().studio
	}
	return localStorageGetCachedItem(LocalStorageProperty.STUDIO) === '1'
}

export function setAllowConfigure(configureMode: boolean) {
	localStorageSetCachedItem(LocalStorageProperty.CONFIGURE, configureMode ? '1' : '0')
}
export function getAllowConfigure(): boolean {
	if (Settings.enableUserAccounts) {
		return !!getUserRoles().configurator
	}
	return localStorageGetCachedItem(LocalStorageProperty.CONFIGURE) === '1'
}

export function setAllowService(serviceMode: boolean) {
	localStorageSetCachedItem(LocalStorageProperty.SERVICE, serviceMode ? '1' : '0')
}
export function getAllowService(): boolean {
	return localStorageGetCachedItem(LocalStorageProperty.SERVICE) === '1'
}

export function setAllowDeveloper(developerMode: boolean) {
	localStorageSetCachedItem(LocalStorageProperty.DEVELOPER, developerMode ? '1' : '0')
}
export function getAllowDeveloper(): boolean {
	if (Settings.enableUserAccounts) {
		return !!getUserRoles().developer
	}
	return localStorageGetCachedItem(LocalStorageProperty.DEVELOPER) === '1'
}

export function setAllowTesting(testingMode: boolean) {
	localStorageSetCachedItem(LocalStorageProperty.TESTING, testingMode ? '1' : '0')
}
export function getAllowTesting(): boolean {
	if (Settings.enableUserAccounts) {
		return !!getUserRoles().developer
	}
	return localStorageGetCachedItem(LocalStorageProperty.TESTING) === '1'
}

// GUI features: ----------------------------------

export function setAllowSpeaking(speakingMode: boolean) {
	localStorageSetCachedItem(LocalStorageProperty.SPEAKING, speakingMode ? '1' : '0')
}
export function getAllowSpeaking(): boolean {
	return localStorageGetCachedItem(LocalStorageProperty.SPEAKING) === '1'
}

export function setHelpMode(helpMode: boolean) {
	localStorageSetCachedItem(LocalStorageProperty.HELP_MODE, helpMode ? '1' : '0')
}

export function getHelpMode(): boolean {
	return localStorageGetCachedItem(LocalStorageProperty.HELP_MODE) === '1'
}

export function setUIZoom(uiZoomLevel: number) {
	localStorageSetCachedItem(LocalStorageProperty.UI_ZOOM_LEVEL, uiZoomLevel + '')
}

export function getUIZoom(): number {
	return parseFloat(localStorageGetCachedItem(LocalStorageProperty.UI_ZOOM_LEVEL) || '1') || 1
}

export function setShowHiddenSourceLayers(show: boolean) {
	localStorageSetCachedItem(LocalStorageProperty.SHOW_HIDDEN_SOURCE_LAYERS, show ? '1' : '0')
}
export function getShowHiddenSourceLayers(): boolean {
	return localStorageGetCachedItem(LocalStorageProperty.SHOW_HIDDEN_SOURCE_LAYERS) === '1'
}

export function setIgnorePieceContentStatus(show: boolean) {
	localStorageSetCachedItem(LocalStorageProperty.IGNORE_PIECE_CONTENT_STATUS, show ? '1' : '0')
}
export function getIgnorePieceContentStatus(): boolean {
	return localStorageGetCachedItem(LocalStorageProperty.IGNORE_PIECE_CONTENT_STATUS) === '1'
}

export function setShelfFollowsOnAir(followOnAir: boolean) {
	localStorageSetCachedItem(LocalStorageProperty.SHELF_FOLLOWS_ON_AIR, followOnAir ? '1' : '0')
}
export function getShelfFollowsOnAir(): boolean {
	// follows on air === true is the default
	return localStorageGetCachedItem(LocalStorageProperty.SHELF_FOLLOWS_ON_AIR) !== '0'
}

export function setReportNotifications(logNotifications: string) {
	localStorageSetCachedItem(LocalStorageProperty.LOG_NOTIFICATIONS, logNotifications)
}
export function unsetReportNotifications() {
	localStorageUnsetCachedItem(LocalStorageProperty.LOG_NOTIFICATIONS)
}
export function getReportNotifications(): string | null {
	return localStorageGetCachedItem(LocalStorageProperty.LOG_NOTIFICATIONS)
}
