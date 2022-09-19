import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { stringifyError } from './lib'

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
	const getLogMethod = (type) => {
		return (...args) => {
			const stringifiedArgs: string[] = _.map(args, (arg) => {
				return stringifyError(arg)
			})
			return Meteor.call('logger', type, ...stringifiedArgs)
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
		warning: getLogMethod('warn'),
		notice: getLogMethod('notice'),
	}
} else {
	const getLogMethod = (type) => {
		return (...args) => {
			// TODO: Should we also send errors and warnings to the server?
			console.log(type, ...args)
			return logger
		}
	}

	const noop = (_type) => {
		// do nothing
		return logger
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
		warning: getLogMethod('warn'),
		notice: getLogMethod('notice'),
	}
	if (localStorage && localStorage.getItem('developerMode') !== '1') {
		// not in developerMode, don't log everything then:
		logger.debug = noop
		logger.silly = noop
	}
}

export { logger }
