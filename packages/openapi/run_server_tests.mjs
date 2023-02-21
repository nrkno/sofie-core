import { exec } from 'child_process'
import { exit } from 'process'
import { join } from 'path'
import { createServer } from 'http'
import { expressAppConfig } from './server/node_modules/oas3-tools/dist/index.js'

const serverPort = 8080
const testTimeout = 120000

async function startServer() {
	const options = { routing: { controllers: join('server', 'controllers') } }
	const appConfig = expressAppConfig(join('server', 'api', 'openapi.yaml'), options)
	const app = appConfig.getApp()

	const server = createServer(app)
	return new Promise((resolve, reject) => {
		server.listen(serverPort, function () {
			console.log(`\nTest server is listening on port ${serverPort}`)
			resolve(server)
		})

		let numRetries = 0
		server.on('error', (e) => {
			if (e.code === 'EADDRINUSE') {
				if (numRetries < 5) {
					console.log('Address in use, retrying...')
					server.close()
					setTimeout(() => {
						server.listen(serverPort, function () {
							console.log(`\nTest server is listening on port ${serverPort}`)
							resolve(server)
						})
					}, 1000)
				} else {
					reject(new Error(`Failed to connect - port ${serverPort} is already in use`))
				}
				numRetries++
			} else reject(e)
		})
	})
}

startServer()
	.then((testServer) => {
		setTimeout(() => {
			console.log('Tests took too long...')
			testServer.close()
			exit(1)
		}, testTimeout)

		console.log('\nRunning tests against test server.')
		exec('yarn unit', { timeout: testTimeout }, (error, stdout, stderr) => {
			testServer.close()
			if (error) {
				console.error(`Test error: ${error}`)
				exit(1)
			}
			console.log(stdout)
			console.log('Warning:', stderr)
			console.log('Tests complete')
			exit()
		})
	})
	.catch((err) => {
		console.error(err)
		exit(1)
	})
