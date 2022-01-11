import * as readPackage from 'read-pkg-up'

const pkgInfo = readPackage.sync()

export function getCurrentTime(): number {
	return Date.now()
}

export function getSystemVersion(): string {
	// Note: This would be useful to have some git hashes in it
	return pkgInfo?.packageJson?.version ?? '0.0.0'
}
