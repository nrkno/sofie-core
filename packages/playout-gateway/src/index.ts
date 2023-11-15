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
		// orgConsoleLog('a')
		if (args.length >= 1) {
			logger.debug(args.join(' '), { rawData: args })
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
		// orgConsoleLog('a')
		if (args.length >= 1) {
			logger.debug(args.join(' '), { rawData: args })
		}
	}
}
function getCurrentTime() {
	const v = Date.now()
	// if (c && c.coreHandler && c.coreHandler.core) {
	// 	v = c.coreHandler.core.getCurrentTime()
	// }
	return new Date(v).toISOString()
}

// Because the default NodeJS-handler sucks and wont display error properly
process.on('warning', (e: any) => {
	logger.error(`Unhandled warning: ${stringifyError(e)}`)
})

logger.info('------------------------------------------------------------------')
logger.info('Starting Playout Gateway')
if (disableWatchdog) logger.info('Watchdog is disabled!')
const connector = new Connector(logger)

logger.info('Core:          ' + config.core.host + ':' + config.core.port)
logger.info('------------------------------------------------------------------')
connector.init(config).catch((e) => {
	logger.error(e)
})
