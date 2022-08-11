import * as Winston from 'winston'

/**
 * Used when JSON.stringifying values that might be circular
 * Usage: JSON.stringify(value, JSONStringifyCircular()))
 */
function JSONStringifyCircular() {
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
	return stringifyFixer
}
const { printf } = Winston.format
const myLogFormat = Winston.format.combine(
	// Winston.format.errors({ stack: true }),
	// Winston.format.metadata(),
	// Winston.format.json()
	// Winston.format.simple()
	printf((obj): string => {
		if (obj instanceof Error) return obj.stack || obj.toString()
		return JSON.stringify(obj, JSONStringifyCircular())
	})
)

/**
 * Intended to be run first in the Gateways.
 * Sets up logging, error handling etc.
 */
export function setupGatewayProcess(options: { logPath: string; logLevel: string | undefined }) {
	let logger: Winston.Logger
	if (options.logPath) {
		// Log json to file, human-readable to console
		const transportConsole = new Winston.transports.Console({
			level: options.logLevel || 'silly',
			handleExceptions: true,
			handleRejections: true,
		})
		const transportFile = new Winston.transports.File({
			level: options.logLevel || 'silly',
			handleExceptions: true,
			handleRejections: true,
			filename: options.logPath,
			format: myLogFormat,
		})

		logger = Winston.createLogger({
			transports: [transportConsole, transportFile],
		})
		logger.info('Logging to', options.logPath)

		// Hijack console.log:
		const orgConsoleLog = console.log
		console.log = function (...args: any[]) {
			// orgConsoleLog('a')
			if (args.length >= 1) {
				try {
					// eslint-disable-next-line @typescript-eslint/ban-ts-comment
					// @ts-ignore one or more arguments
					logger.debug(...args)
					// logger.debug(...args.map(JSONStringifyCircular()))
				} catch (e) {
					orgConsoleLog('CATCH')
					orgConsoleLog(...args)
					throw e
				}
				orgConsoleLog(...args)
			}
		}
	} else {
		// custom json stringifier

		// Log json to console
		const transportConsole = new Winston.transports.Console({
			level: options.logLevel || 'silly',
			handleExceptions: true,
			handleRejections: true,
			format: myLogFormat,
		})

		logger = Winston.createLogger({
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
					else msg += ' ' + JSON.stringify(args[i], JSONStringifyCircular())
				}
			}

			orgMethod(msg, meta)
		}
	}

	return {
		logger,
	}
}

/** Do various loggings, to test that logging works as intended */
export function testLogging(logger: Winston.Logger) {
	const o: any = {
		a: 1,
		b: {
			c: 2,
		},
	}
	o.b['d'] = o // circular reference

	const err = new Error('Hello')

	console.log('Logging to console.log')
	console.error('Logging to console.error')

	console.log('console.log: error', err)
	console.log(err)
	console.log('console.log: obj', o)

	console.log('console.log: many arguments', 'a', 'b', 'c', 'd')

	logger.silly('logger silly')
	logger.verbose('logger verbose')
	logger.debug('logger debug')
	logger.info('logger info')
	logger.warn('logger warn')
	logger.error('logger error')

	logger.error(err)
	logger.error('Heres an error:', err)
	logger.info('Heres an obj', o)
	logger.info('Heres many arguments', 'a', 'b', 'c', 'd')

	setTimeout(() => {
		// Asynchronous error:
		throw err
	}, 1)

	setTimeout(() => {
		// Asynchronous error:
		// @ts-ignore
		DaleATuCuerpoAlegría(Macarena)
	}, 1)

	setTimeout(() => {
		// unhandled promise:
		const p = new Promise((_, reject) => {
			setTimeout(() => {
				reject(new Error('Rejecting promise!'))
			}, 1)
		})
		p.then(() => {
			// nothing
		})
	}, 1)
}
