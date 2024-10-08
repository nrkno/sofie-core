import { stringifyError } from '@sofie-automation/server-core-integration'
import * as Winston from 'winston'

export function getVersions(logger: Winston.Logger): { [packageName: string]: string } {
	const versions: { [packageName: string]: string } = {}

	if (process.env.npm_package_version) {
		versions['_process'] = process.env.npm_package_version
	}

	const pkgNames = ['@mos-connection/connector']
	try {
		for (const pkgName of pkgNames) {
			try {
				// eslint-disable-next-line @typescript-eslint/no-var-requires
				const pkgInfo = require(`${pkgName}/package.json`)
				versions[pkgName] = pkgInfo.version || 'N/A'
			} catch (e) {
				logger.error(`Failed to load package.json for lib "${pkgName}": ${stringifyError(e)}`)
			}
		}
	} catch (e) {
		logger.error(e)
	}
	return versions
}
