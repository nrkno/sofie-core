export function getCurrentTime(): number {
	return Date.now()
}

export function getSystemVersion(): string {
	return '0.1.2' // TODO
	// return PackageInfo.versionExtended || PackageInfo.version
}
