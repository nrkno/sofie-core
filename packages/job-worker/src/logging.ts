import * as Winston from 'winston'

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
