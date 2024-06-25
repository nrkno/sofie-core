import fs from 'fs/promises'
import path from 'path'
import { CURRENT_SYSTEM_VERSION } from '../currentSystemVersion'

describe('CURRENT_SYSTEM_VERSION', () => {
	it('Matches the package.json version', async () => {
		const currentSystemVersion = CURRENT_SYSTEM_VERSION

		const packageJson = JSON.parse(
			await fs.readFile(path.join(__dirname, '../../../package.json'), {
				encoding: 'utf8',
			})
		)

		const packageVersion = packageJson.version

		if (packageVersion.includes('-')) {
			console.warn(`Package version is pre-release. Mismatch is fine.`)
			console.log(`package.json version: ${packageVersion}`)
			console.log(`currentSystemVersion.ts version: ${currentSystemVersion}`)
			return
		}

		if (packageVersion !== currentSystemVersion) {
			throw new Error(
				`Package version ("${packageVersion}") does not match CURRENT_SYSTEM_VERSION ("${currentSystemVersion}")!`
			)
		}
	})
})
