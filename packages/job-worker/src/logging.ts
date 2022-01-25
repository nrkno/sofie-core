import { stringifyError } from '@sofie-automation/corelib/dist/lib'
import * as Winston from 'winston'
import TransportStream = require('winston-transport')

// Log all to console for now. Can be improved later
const consoleTransport = new Winston.transports.Console({
	level: 'silly',
	handleExceptions: true,
	handleRejections: true,
})

// Setup logging --------------------------------------
export const logger = Winston.createLogger({
	format: Winston.format.json(),
	transports: [consoleTransport],
})

export function interceptLogging(handler: (msg: unknown) => Promise<void>) {
	const customTransport = new CustomTransport(handler)

	// Replace transports
	logger.add(customTransport)
	logger.remove(consoleTransport)
}

export function addThreadNameToLogLine(threadName: string, msg: unknown): Winston.LogEntry {
	if (typeof msg === 'object') {
		return {
			...(msg as Winston.LogEntry),
			threadName: threadName,
		}
	} else {
		return {
			message: stringifyError(msg),
			level: 'info',
			threadName: threadName,
		}
	}
}

class CustomTransport extends TransportStream {
	constructor(
		private readonly handler: (msg: unknown) => Promise<void>,
		options: TransportStream.TransportStreamOptions = {}
	) {
		super(options)

		this.setMaxListeners(30)
	}

	log(info: any, next: () => void) {
		setImmediate(() => this.emit('logged', info))

		this.handler(info).catch((e) => {
			// Something failed, so write to the console instead
			console.error(`Failed to proxy message: ${stringifyError(e)}`, info)
		})

		if (next) {
			next()
		}
	}
}
