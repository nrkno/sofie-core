
import { Meteor } from 'meteor/meteor'
import * as Winston from 'winston'
import * as fs from 'fs'

// @todo: remove this and do a PR to https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/winston
// because there's an error in the typings logging.debug() takes any, not only string
interface LoggerInstanceFixed extends Winston.LoggerInstance {
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
interface LeveledLogMethodFixed {
	(msg: any, callback: Winston.LogCallback): LoggerInstanceFixed
	(msg: any, meta: any, callback: Winston.LogCallback): LoggerInstanceFixed
	(msg: any, ...meta: any[]): LoggerInstanceFixed
}
let logger: LoggerInstanceFixed = new (Winston.Logger)({
})

let leadingZeros = (num,length) => {
	num = num + ''
	if (num.length < length) {
		return '00000000000000000000000000000000000000000'.slice(0,length - num.length) + num
	} else {
		return num
	}
}

// console.log(Meteor)
let time = new Date()
let startDate = time.getFullYear() + '-' +
	leadingZeros(time.getMonth(),2) + '-' +
	leadingZeros(time.getDate(),2) + '_' +
	leadingZeros(time.getHours(),2) + '_' +
	leadingZeros(time.getMinutes(),2) + '_ ' +
	leadingZeros(time.getSeconds(),2)
let logDirectory = Meteor['absolutePath'] + '/.meteor/local/log'
let logPath = logDirectory + '/log_' + startDate + '.log'
// let logPath = './log/'

if (!fs.existsSync(logDirectory)) {
	fs.mkdirSync(logDirectory)
}

logger.add(Winston.transports.Console, {
	level: 'verbose',
	handleExceptions: true,
	json: false
})
logger.add(Winston.transports.File, {
	level: 'silly',
	handleExceptions: true,
	json: true,
	filename: logPath
})
// let orgConsoleLog = console.log
// console.log = (...args) => {
// 	// @ts-ignore
// 	logger.debug(...args)
// }
console.log('Logging to ' + logPath)

logger.info('Starting up')

export { logger }
