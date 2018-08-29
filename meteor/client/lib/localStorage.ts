
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
