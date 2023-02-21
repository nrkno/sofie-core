const yaml = require('js-yaml')
const fs = require('fs')

module.exports = async function () {
	// Read the required URL from the API yaml file
	const doc = yaml.load(fs.readFileSync('./api/actions.yaml', 'utf8'))

	// Test whether the current server is a test server
	process.env.SERVER_TYPE = 'TEST'
	process.env.ACTIONS_URL = 'http://localhost:8080/api2'
	await fetch(`${process.env.ACTIONS_URL}/`).catch(() => {
		console.log('Connecting to Sofie Actions server')
		process.env.SERVER_TYPE = 'SOFIE'
		process.env.ACTIONS_URL = doc.servers[0].url
	})
}
