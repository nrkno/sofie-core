const yaml = require('js-yaml')
const fs = require('fs')

module.exports = async function () {
	// Read the required URL from the API yaml file
	const doc = yaml.load(fs.readFileSync('./api/actions.yaml', 'utf8'))

	// Test whether the current server is a test server
	if (!process.env.SERVER_TYPE) {
		process.env.SERVER_TYPE = 'TEST'
	}

	if (!process.env.SERVER_URL) {
		process.env.SERVER_URL = 'http://localhost:3000/api/v1.0'
	}

	await fetch(`${process.env.SERVER_URL}/`).catch(() => {
		console.log('Connecting to Sofie Actions server')
		process.env.SERVER_TYPE = 'SOFIE'
		process.env.SERVER_URL = doc.servers[0].url
	})
}
