import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

// TODO: These types should perhaps be made a little more solid
export type LeveledLogMethodFixed = (msg: any, ...meta: any[]) => void
export interface LoggerInstanceFixed {
	// for cli and npm levels
	error: LeveledLogMethodFixed
	warn: LeveledLogMethodFixed
	help: LeveledLogMethodFixed
	data: LeveledLogMethodFixed
	info: LeveledLogMethodFixed
	debug: LeveledLogMethodFixed
	prompt: LeveledLogMethodFixed
	http: LeveledLogMethodFixed
	verbose: LeveledLogMethodFixed
	input: LeveledLogMethodFixed
	silly: LeveledLogMethodFixed

	// for syslog levels only
	emerg: LeveledLogMethodFixed
	alert: LeveledLogMethodFixed
	crit: LeveledLogMethodFixed
	warning: LeveledLogMethodFixed
	notice: LeveledLogMethodFixed
}

// Setup logging --------------------------------------
export const logger: LoggerInstanceFixed = {
	error: (...args: any[]) => handleLog('error', ...args),
	warn: (...args: any[]) => handleLog('warn', ...args),
	help: (...args: any[]) => handleLog('help', ...args),
	data: (...args: any[]) => handleLog('data', ...args),
	info: (...args: any[]) => handleLog('info', ...args),
	debug: (...args: any[]) => handleLog('debug', ...args),
	prompt: (...args: any[]) => handleLog('prompt', ...args),
	http: (...args: any[]) => handleLog('http', ...args),
	verbose: (...args: any[]) => handleLog('verbose', ...args),
	input: (...args: any[]) => handleLog('input', ...args),
	silly: (...args: any[]) => handleLog('silly', ...args),

	// for syslog levels only
	emerg: (...args: any[]) => handleLog('emerg', ...args),
	alert: (...args: any[]) => handleLog('alert', ...args),
	crit: (...args: any[]) => handleLog('crit', ...args),
	warning: (...args: any[]) => handleLog('warning', ...args),
	notice: (...args: any[]) => handleLog('notice', ...args),
}
function handleLog(level: string, ...args: any[]) {
	for (const target of targets) {
		target(level, args)
	}
}

export interface LogEntry {
	level: string
	source: string
	message: string
}

type LogLineHandler = (msg: LogEntry) => Promise<void>
type LogTarget = (level: string, args: any[]) => void
const targets: LogTarget[] = []

/** Intercept all calls to the logger, and pipe the results to logLine */
export function interceptLogging(threadName: string, logLine: LogLineHandler): void {
	targets.push((level: string, args: any[]) => {
		const message: string = args.map((arg) => stringifyError(arg)).join(',')

		logLine({
			level,
			source: threadName,
			message,
		}).catch(console.error)
	})
}
