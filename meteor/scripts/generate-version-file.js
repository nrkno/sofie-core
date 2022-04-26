const moment = require('moment')
const fs = require('fs')
const path = require('path')
const simpleGit = require('simple-git/promise')('..')

const pkgPath = path.join(__dirname, '../package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath))

;(async () => {
	const commitTime = await simpleGit.raw(['log', '-1', '--pretty=format:%ct', 'HEAD'])
	const dateStr = moment(parseInt(commitTime, 10) * 1000).format('YYYYMMDD-HHmm')
	const commitHash = await simpleGit.revparse(['--short', 'HEAD'])
	const branch = (await simpleGit.raw(['rev-parse', '--abbrev-ref', 'HEAD'])).trim()

	const isRelease = branch === 'main' || branch === 'master' // Support "main" for future-compat

	if (isRelease) {
		pkg.versionExtended = `${pkg.version}+g${commitHash}-${dateStr}`
	} else {
		pkg.versionExtended = `${pkg.version}+${branch.trim()}-g${commitHash}-${dateStr}`
	}

	console.log('Version:', pkg.versionExtended)

	fs.writeFileSync(pkgPath, JSON.stringify(pkg, undefined, 2))
})()
