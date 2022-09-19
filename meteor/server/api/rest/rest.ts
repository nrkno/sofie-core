import { ServerResponse, IncomingMessage } from 'http'
import { Params } from 'meteor/meteorhacks:picker'
import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { MeteorMethodSignatures } from '../../methods'
import { PubSub } from '../../../lib/api/pubsub'
import { MeteorPublications, MeteorPublicationSignatures } from '../../publications/lib'
import { UserActionAPIMethods } from '../../../lib/api/userActions'
import { PickerPOST, PickerGET, AsyncRouter } from '../http'
import { logger } from '../../../lib/logging'
import { ClientAPI } from '../../../lib/api/client'

const apiVersion = 0

const index = {
	version: `${apiVersion}`,
	GET: [] as string[],
	POST: [] as string[],
}

/**
 * Takes an array of strings and converts them to Null, Boolean, Number, String primitives or Objects, if the string
 * seems like a valid JSON.
 *
 * @param args Array of URL-encoded strings
 */
function typeConvertUrlParameters(args: any[]) {
	const convertedArgs: any[] = []

	args.forEach((val, i) => {
		if (val === 'null') val = null
		else if (val === 'true') val = true
		else if (val === 'false') val = false
		else {
			val = decodeURIComponent(val)

			if (!_.isNaN(Number(val))) {
				val = Number(val)
			} else {
				let json: any = null
				try {
					json = JSON.parse(val)
				} catch (e) {
					// ignore
				}
				if (json) val = json
			}
		}

		convertedArgs[i] = val
	})

	return convertedArgs
}

Meteor.startup(() => {
	// Expose all user actions:

	_.each(_.keys(UserActionAPIMethods), (methodName) => {
		const methodValue = UserActionAPIMethods[methodName]
		const signature = MeteorMethodSignatures[methodValue]

		let resource = `/api/${apiVersion}/action/${methodName}`
		let docString = resource
		_.each(signature || [], (paramName, i) => {
			resource += `/:param${i}`
			docString += `/:${paramName}`
		})

		assignRoute('POST', resource, docString, (args) => {
			const convArgs = typeConvertUrlParameters(args)
			return Meteor.call(methodValue, ...convArgs)
		})
	})

	// Expose publications:
	_.each(_.keys(PubSub), (pubName) => {
		const pubValue = PubSub[pubName]
		const signature = MeteorPublicationSignatures[pubValue]

		const f = MeteorPublications[pubValue]

		if (f) {
			let resource = `/api/${apiVersion}/publication/${pubName}`
			let docString = resource
			_.each(signature || [], (paramName, i) => {
				resource += `/:param${i}`
				docString += `/:${paramName}`
			})

			assignRoute('GET', resource, docString, (args) => {
				const convArgs = typeConvertUrlParameters(args)
				const cursor = f.apply(
					{
						ready: () => null,
					},
					convArgs
				)
				if (cursor) return cursor.fetch()
				return []
			})
		}
	})
})

/**
 * Send a resulting payload back to the HTTP client. If the payload is an Object, it will be sent as JSON, otherwise
 * will be sent as Plain Text.
 *
 * @param {ServerResponse} res
 * @param {number} statusCode
 * @param {*} payload
 */
function sendResult(res: ServerResponse, statusCode: number, payload: any) {
	res.statusCode = statusCode
	res.setHeader('Content-Type', typeof payload === 'object' ? 'application/json' : 'text/plain')
	res.end(typeof payload === 'object' ? JSON.stringify(payload) : String(payload))
}

/**
 * Send an error back to the HTTP client. If the error object is a Meteor.Error, use the Error.error value as
 * HTTP error code. Otherwise, send generic 500 error.
 *
 * @param {ServerResponse} res
 * @param {*} e
 */
function sendError(res: ServerResponse, e: any) {
	if (e.error && e.reason) {
		// is Meteor.Error
		sendResult(res, e.error, String(e.reason))
	} else {
		sendResult(res, 500, String(e))
	}
}

function assignRoute(routeType: 'POST' | 'GET', resource: string, indexResource: string, fcn: (p: any[]) => any) {
	const route: AsyncRouter = routeType === 'POST' ? PickerPOST : PickerGET

	index[routeType].push(indexResource)
	route.route(resource, async (params: Params, req: IncomingMessage, res: ServerResponse) => {
		logger.info(`REST APIv0: ${req.connection.remoteAddress} ${routeType} "${req.url}"`, {
			url: req.url,
			method: routeType,
			remoteAddress: req.connection.remoteAddress,
			remotePort: req.connection.remotePort,
			headers: req.headers,
		})
		const p: any[] = []
		for (let i = 0; i < 20; i++) {
			if (_.has(params, 'param' + i)) {
				p.push(params['param' + i])
			} else {
				break
			}
		}
		try {
			const p: any[] = []
			for (let i = 0; i < 20; i++) {
				if (_.has(params, 'param' + i)) {
					p.push(params['param' + i])
				} else {
					break
				}
			}

			const result = await fcn(p)

			let code = 200
			if (ClientAPI.isClientResponseError(result)) {
				code = 500
			}
			sendResult(res, code, result)
		} catch (e) {
			sendError(res, e)
		}
	})
}

PickerGET.route('/api', async (params, req: IncomingMessage, res: ServerResponse) => {
	res.statusCode = 301
	res.setHeader('Location', '/api/0') // redirect to latest API version
	res.end()
})
PickerGET.route('/api/0', async (params, req: IncomingMessage, res: ServerResponse) => {
	res.setHeader('Content-Type', 'application/json')
	res.statusCode = 200
	res.end(JSON.stringify(index, undefined, 2))
})
