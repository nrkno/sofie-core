import { Connector } from './connector'
import { config, logPath, disableWatchdog, logLevel } from './config'

import * as Winston from 'winston'
import { stringifyError } from '@sofie-automation/server-core-integration'

console.log('process started') // This is a message all Sofie processes log upon startup

// Setup logging --------------------------------------
let logger: Winston.Logger
if (logPath) {
	const transportConsole = new Winston.transports.Console({
		level: logLevel || 'silly',
		handleExceptions: true,
		handleRejections: true,
	})
	const transportFile = new Winston.transports.File({
		level: logLevel || 'silly',
		handleExceptions: true,
		handleRejections: true,
		filename: logPath,
		format: Winston.format.json(),
	})

	logger = Winston.createLogger({
		transports: [transportConsole, transportFile],
	})
	logger.info('Logging to', logPath)

	// Hijack console.log:
	const orgConsoleLog = console.log
	console.log = function (...args: any[]) {
		if (args.length >= 1) {
			// @ts-expect-error one or more arguments
			logger.debug(...args)
			orgConsoleLog(...args)
		}
	}
} else {
	// custom json stringifier
	const { splat, combine, printf } = Winston.format
	const myFormat = printf((obj) => {
		obj.localTimestamp = getCurrentTime()
		obj.randomId = Math.round(Math.random() * 10000)
		return JSON.stringify(obj) // make single line
	})

	// Log json to console
	const transportConsole = new Winston.transports.Console({
		level: logLevel || 'silly',
		handleExceptions: true,
		handleRejections: true,
		format: combine(splat(), myFormat),
	})

	logger = Winston.createLogger({
		transports: [transportConsole],
	})
	logger.info('Logging to Console')

	// Hijack console.log:
	console.log = function (...args: any[]) {
		if (args.length >= 1) {
			// Does something weird if passing array of strings
			logger.debug(args.join())
		}
	}
}
function getCurrentTime() {
	const v = Date.now()
	return new Date(v).toISOString()
}

// Because the default NodeJS-handler sucks and wont display error properly
process.on('warning', (e: any) => {
	logger.error(`Unhandled warning: ${stringifyError(e)}`)
})

logger.info('------------------------------------------------------------------')
logger.info('Starting Live Status Gateway')
if (disableWatchdog) logger.info('Watchdog is disabled!')
const connector = new Connector(logger)

logger.info('Core:          ' + config.core.host + ':' + config.core.port)
logger.info('------------------------------------------------------------------')
connector.init(config).catch((e) => {
	logger.error(e)
})
