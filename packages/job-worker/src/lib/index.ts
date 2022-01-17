import * as readPackage from 'read-pkg-up'

export * from './time'

const pkgInfo = readPackage.sync()
export function getSystemVersion(): string {
	// Note: This would be useful to have some git hashes in it
	return pkgInfo?.packageJson?.version ?? '0.0.0'
}
