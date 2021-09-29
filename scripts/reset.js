const promisify = require('util').promisify
const rimraf = promisify(require('rimraf'))

log('Removing all artifacts...')

async function rimrafLog(command) {
	log('  ' + command)
	return rimraf(command)
}

;(async () => {
	await rimrafLog('./meteor/.meteor/local')
	await rimrafLog('./meteor/node_modules')
	await rimrafLog('./meteor/coverage')

	await rimrafLog('./packages/node_modules')
	await rimrafLog('./packages/*/node_modules')
	await rimrafLog('./packages/*/dist')

	log(`...done!`)
	log(`To install everything again, run "yarn start"`)
})().catch(log)

function log(...args) {
	// eslint-disable-next-line no-console
	console.log(...args)
}
