import { Meteor } from 'meteor/meteor'

export interface LoggerInstanceFixed {
	error: LeveledLogMethodFixed
	warn: LeveledLogMethodFixed
	help: LeveledLogMethodFixed
	data: LeveledLogMethodFixed
	info: LeveledLogMethodFixed
	debug: LeveledLogMethodFixed
	prompt: LeveledLogMethodFixed
	verbose: LeveledLogMethodFixed
	input: LeveledLogMethodFixed
	silly: LeveledLogMethodFixed

	emerg: LeveledLogMethodFixed
	alert: LeveledLogMethodFixed
	crit: LeveledLogMethodFixed
	warning: LeveledLogMethodFixed
	notice: LeveledLogMethodFixed
}
type Winston_LogCallback = (error?: any, level?: string, msg?: string, meta?: any) => void
export interface LeveledLogMethodFixed {
	(msg: any, callback: Winston_LogCallback): LoggerInstanceFixed
	(msg: any, meta: any, callback: Winston_LogCallback): LoggerInstanceFixed
	(msg: any, ...meta: any[]): LoggerInstanceFixed
}

let logger: LoggerInstanceFixed
if (Meteor.isServer) {
	let getLogMethod = (type) => {
		return (...args) => {
			return Meteor.call('logger', type, ...args)
		}
	}

	logger = {
		error: getLogMethod('error'),
		warn: getLogMethod('warn'),
		help: getLogMethod('help'),
		data: getLogMethod('data'),
		info: getLogMethod('info'),
		debug: getLogMethod('debug'),
		prompt: getLogMethod('prompt'),
		verbose: getLogMethod('verbose'),
		input: getLogMethod('input'),
		silly: getLogMethod('silly'),

		emerg: getLogMethod('emerg'),
		alert: getLogMethod('alert'),
		crit: getLogMethod('crit'),
		warning: getLogMethod('warning'),
		notice: getLogMethod('notice')
	}
} else {
	let getLogMethod = (type) => {
		return (...args) => {
			console.log(type, ...args)
			// TODO: Maybe add sending logs to server here?
			// Meteor.call('logger', type, ...args)
			return logger
		}
	}
	logger = {
		error: getLogMethod('error'),
		warn: getLogMethod('warn'),
		help: getLogMethod('help'),
		data: getLogMethod('data'),
		info: getLogMethod('info'),
		debug: getLogMethod('debug'),
		prompt: getLogMethod('prompt'),
		verbose: getLogMethod('verbose'),
		input: getLogMethod('input'),
		silly: getLogMethod('silly'),

		emerg: getLogMethod('emerg'),
		alert: getLogMethod('alert'),
		crit: getLogMethod('crit'),
		warning: getLogMethod('warning'),
		notice: getLogMethod('notice')
	}
}

export { logger }
