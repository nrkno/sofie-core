
import { Meteor } from 'meteor/meteor'
import * as Winston from 'winston'
import * as fs from 'fs'

let logger: Winston.LoggerInstance = new (Winston.Logger)({
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
