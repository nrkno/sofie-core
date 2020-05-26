const moment = require('moment')
const fs = require('fs')
const path = require('path')
const simpleGit = require('simple-git/promise')('..')

const isRelease = !!process.argv.find(a => a.match(/--release/i))
// console.log('release:', isRelease)

const pkgPath = path.join(__dirname, '../package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath))

;(async () => {
	const commitTime = await simpleGit.raw(['log', '-1', '--pretty=format:%ct', 'HEAD'])
	const dateStr = moment(parseInt(commitTime, 10) * 1000).format('YYYYMMDD-HHmm')

	if (isRelease) {
		const commitHash = await simpleGit.revparse(['--short', 'HEAD'])
		pkg.versionExtended = `${pkg.version}+g${commitHash}-${dateStr}`
	} else {
		const versionStr = await simpleGit.raw(['describe', '--always'])
		const branch = await simpleGit.raw(['rev-parse', '--abbrev-ref', 'HEAD'])
		pkg.versionExtended = `${pkg.version}+${branch.trim()}-${versionStr.trim()}-${dateStr}`
	}

	console.log('Version:', pkg.versionExtended)

	fs.writeFileSync(pkgPath, JSON.stringify(pkg, undefined, 2))

})()
