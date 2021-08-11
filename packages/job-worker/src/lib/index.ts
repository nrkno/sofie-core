export function getCurrentTime(): number {
	return Date.now()
}

export function getSystemVersion(): string {
	return '0.1.2' // TODO: Worker
	// return PackageInfo.versionExtended || PackageInfo.version
}
