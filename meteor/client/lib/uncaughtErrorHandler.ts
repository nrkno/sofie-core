import { Meteor } from 'meteor/meteor'
import { Tracker } from 'meteor/tracker'
import { Time } from 'tv-automation-sofie-blueprints-integration'
import { getCurrentTime } from '../../lib/lib'
import { ClientAPI } from '../../lib/api/client'
import { MeteorCall } from '../../lib/api/methods'

interface LoggedError {
	location: string
	content: any
	added: Time
}

let errorCache: Array<LoggedError> = []
const MAX_ERROR_CACHE_COUNT = 10

try {
	errorCache = JSON.parse(localStorage.getItem('errorCache') || '[]')
} catch (e) {
	errorCache = []
}

function sendErrorToCore (errorLog: LoggedError) {
	MeteorCall.client.clientErrorReport(errorLog.added, errorLog.content, errorLog.location)
	.then(() => {

		const sentIdx = errorCache.indexOf(errorLog)
		if (sentIdx >= 0) {
			errorCache.splice(sentIdx, 1)
		}
		localStorage.setItem('errorCache', JSON.stringify(errorCache))
	}).catch(() => {
		// fail silently, so that we don't erase useful logs with multiple 'failed to send' messages
		return
	})
}

function uncaughtErrorHandler (errorObj: any) {
	const errorLog = {
		location: window.location.href,
		content: errorObj,
		added: getCurrentTime()
	}

	errorCache.push(errorLog)

	if (errorCache.length > MAX_ERROR_CACHE_COUNT) {
		errorCache.shift()
	}

	localStorage.setItem('errorCache', JSON.stringify(errorCache))

	if (Meteor.status().connected) {
		sendErrorToCore(errorLog)
	}
}

const originalConsoleError = console.error
console.error = (...args: any[]) => {
	try {
		uncaughtErrorHandler(args)
	} catch (e) {
		// well, we can't do much then...
	}
	originalConsoleError(...args)
}

const originalOnError = window.onerror
window.onerror = (event, source, line, col, error) => {
	try {
		uncaughtErrorHandler({
			event,
			source,
			line,
			col,
			error
		})
	} catch (e) {
		// ell, we can't do much then...
	}
	if (originalOnError) {
		originalOnError(event, source, line, col, error)
	}
}

Meteor.startup(() => {
	let resendNextAutorun = false

	Tracker.autorun(() => {
		if (!Meteor.status().connected) {
			resendNextAutorun = true
		} else if (Meteor.status().connected && resendNextAutorun) {
			resendNextAutorun = false
			const copy = errorCache.concat()
			copy.forEach((item) => sendErrorToCore(item))
		}
	})
})
