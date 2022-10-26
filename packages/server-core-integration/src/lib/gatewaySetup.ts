import * as Winston from 'winston'

/**
 * Used instad of JSON.stringifying for values that might be circular
 */
function JSONStringifyCircular(obj: unknown): string {
	const cacheValues: any[] = []
	const cacheKeys: any[] = []
	const stringifyFixer = (key: string, value: any) => {
		if (typeof value === 'object' && value !== null) {
			const i = cacheValues.indexOf(value)
			if (i !== -1) {
				// Duplicate reference found
				try {
					// If this value does not reference a parent it can be deduped
					return JSON.parse(JSON.stringify(value))
				} catch (error) {
					// discard key if value cannot be deduped
					return '[circular of ' + (cacheKeys[i] || '*root*') + ']'
				}
			}
			// Store value in our collection
			cacheValues.push(value)
			cacheKeys.push(key)
		}
		return value
	}
	return JSON.stringify(obj, stringifyFixer)
}

const { printf } = Winston.format
const myLogFormat = Winston.format.combine(
	// Winston.format.errors({ stack: true }),
	// Winston.format.metadata(),
	// Winston.format.json()
	// Winston.format.simple()
	printf((obj): string => {
		if (obj instanceof Error) return obj.stack || obj.toString()
		return JSONStringifyCircular(obj)
	})
)

/**
 * Intended to be run first in the Gateways.
 * Sets up logging, error handling etc.
 */
export function setupGatewayProcess(options: { logPath: string; logLevel: string | undefined }): {
	logger: Winston.Logger
} {
	let logger: Winston.Logger
	if (options.logPath) {
		// Log json to file, human-readable to console
		logger = createLoggerToFileAndConsole(options.logLevel, options.logPath)
	} else {
		// custom json stringifier
		logger = createLoggerToConsole(options.logLevel)
	}

	// Because the default NodeJS-handler sucks and wont display error properly
	process.on('warning', (e: any) => {
		logger.warn('Unhandled warning, see below')
		logger.error('error', e)
		logger.error('error.reason', e.reason || e.message)
		logger.error('error.stack', e.stack)
	})
	// Override the logger methods, to handle a few common cases:
	for (const method of [
		'error',
		'warn',
		'help',
		'data',
		'info',
		'debug',
		'prompt',
		'http',
		'verbose',
		'input',
		'silly',
	]) {
		const orgMethod = (logger as any)[method]
		;(logger as any)[method] = (...args: any[]) => {
			if (args[0] instanceof Error) {
				args.unshift('')
			}

			let msg = args[0] || ''
			let meta: any = undefined

			for (let i = 1; i < args.length; i++) {
				if (typeof args[i] === 'string') {
					msg += ' ' + args[i]
				} else {
					if (meta === undefined) meta = args[i]
					else msg += ' ' + JSONStringifyCircular(args[i])
				}
			}

			orgMethod(msg, meta)
		}
	}

	return {
		logger,
	}
}

function createLoggerToConsole(logLevel: string | undefined): Winston.Logger {
	// Log json to console
	const transportConsole = new Winston.transports.Console({
		level: logLevel || 'silly',
		handleExceptions: true,
		handleRejections: true,
		format: myLogFormat,
	})

	const logger = Winston.createLogger({
		transports: [transportConsole],
	})
	logger.info('Logging to Console')

	// Hijack console.log:
	console.log = (...args: any[]) => {
		if (args.length >= 1) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore one or more arguments
			logger.debug(...args)
		}
	}
	console.error = (...args: any[]) => {
		if (args.length >= 1) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore one or more arguments
			logger.error(...args)
		}
	}

	return logger
}

function createLoggerToFileAndConsole(logLevel: string | undefined, logPath: string): Winston.Logger {
	// Log json to file, human-readable to console
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
		format: myLogFormat,
	})

	const logger = Winston.createLogger({
		transports: [transportConsole, transportFile],
	})
	logger.info('Logging to', logPath)

	// Hijack console.log:
	const orgConsoleLog = console.log
	console.log = function (...args: any[]) {
		// orgConsoleLog('a')
		if (args.length >= 1) {
			try {
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-ignore one or more arguments
				logger.debug(...args)
			} catch (e) {
				orgConsoleLog('CATCH')
				orgConsoleLog(...args)
				throw e
			}
			orgConsoleLog(...args)
		}
	}

	return logger
}
