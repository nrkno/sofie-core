
export function setStudioMode (studioMode: boolean) {
	localStorage.setItem('studioMode', (studioMode ? '1' : '0'))
}
export function getStudioMode (): boolean {
	return localStorage.getItem('studioMode') === '1'
}

export function setAdminMode (adminMode: boolean) {
	localStorage.setItem('adminMode', (adminMode ? '1' : '0'))
}
export function getAdminMode (): boolean {
	return localStorage.getItem('adminMode') === '1'
}

export function setDeveloperMode (developerMode: boolean) {
	localStorage.setItem('developerMode', (developerMode ? '1' : '0'))
}
export function getDeveloperMode (): boolean {
	return localStorage.getItem('developerMode') === '1'
}

export function setTestingMode (testingMode: boolean) {
	localStorage.setItem('testingMode', (testingMode ? '1' : '0'))
}
export function getTestingMode (): boolean {
	return localStorage.getItem('testingMode') === '1'
}
export function setSpeakingMode (speakingMode: boolean) {
	localStorage.setItem('speakingMode', (speakingMode ? '1' : '0'))
}
export function getSpeakingMode (): boolean {
	return localStorage.getItem('speakingMode') === '1'
}

export function setUIZoom (uiZoomLevel: number) {
	localStorage.setItem('uiZoomLevel', uiZoomLevel + '')
}

export function getUIZoom (): number {
	return parseFloat(localStorage.getItem('uiZoomLevel') || '1') || 1
}
