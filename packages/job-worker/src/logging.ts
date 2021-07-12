import * as Winston from 'winston'
export interface LoggerInstance extends Winston.LoggerInstance {
	warning: never // logger.warning is not a function
}

// Setup logging --------------------------------------
export const logger = new Winston.Logger({}) as LoggerInstance
// Log all to console for now. Will be improved later
logger.add(Winston.transports.Console, {
	level: 'verbose',
	handleExceptions: true,
	json: false,
})
