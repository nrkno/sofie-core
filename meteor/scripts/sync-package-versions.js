const fs = require('fs')
const path = require('path')
const standardVersion = require('standard-version')

const pkgPath = path.join(__dirname, '../package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath))

const origDir = __dirname

;(async () => {
	const packagesPath = path.join(__dirname, '../../packages')
	const dirs = fs.readdirSync(packagesPath)
	for (const dir of dirs) {
		const libPkgPath = path.join(packagesPath, dir, 'package.json')
		if (fs.existsSync(libPkgPath)) {
			console.log('Updating', libPkgPath, 'to', pkg.version)

			// Change the dir to make standard version run correctly
			process.chdir(path.join(packagesPath, dir))
			await standardVersion({
				path: '.',
				skip: {
					tag: true,
					commit: true,
					changelog: !process.env.GENERATE_CHANGELOGS,
				},
				releaseAs: pkg.version,
			})
			// Change the dir back to before
			process.chdir(origDir)
			console.log('Done')
		}
	}
})()
