import { ServerResponse, IncomingMessage } from 'http'
import { Router, Params } from 'meteor/meteorhacks:picker'
import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { MeteorMethodSignatures } from '../../methods'
import { PubSub } from '../../../lib/api/pubsub'
import { MeteorPublications, MeteorPublicationSignatures } from '../../publications/lib'
import { UserActionAPIMethods } from '../../../lib/api/userActions'
import { PickerPOST, PickerGET } from '../http'

const apiVersion = 0

const index = {
	version: `${apiVersion}`,
	GET: [] as string[],
	POST: [] as string[],
}

function typeConvertUrlParameters(args: any[]) {
	const convertedArgs: any[] = []

	for (const i in args) {
		let val = args[i]
		if (val === 'null') val = null
		else if (val === 'true') val = true
		else if (val === 'false') val = false
		else {
			val = unescape(val)

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
	}

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

function sendResult(res: ServerResponse, statusCode: number, payload: any) {
	res.statusCode = statusCode
	res.setHeader('Content-Type', typeof payload === 'object' ? 'application/json' : 'text/plain')
	res.end(typeof payload === 'object' ? JSON.stringify(payload) : String(payload))
}

function sendError(res: ServerResponse, e: any) {
	if (e.error && e.reason) {
		// is Meteor.Error
		sendResult(res, e.error, String(e.reason))
	} else {
		sendResult(res, 500, String(e))
	}
}

function assignRoute(routeType: 'POST' | 'GET', resource: string, indexResource: string, fcn: (p: any[]) => any) {
	const route: Router = routeType === 'POST' ? PickerPOST : PickerGET

	index[routeType].push(indexResource)
	route.route(resource, (params: Params, req: IncomingMessage, res: ServerResponse) => {
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
			const result = fcn(p)

			if (result && typeof result.then === 'function') {
				result.then(
					(resolvedResult) => {
						sendResult(res, 200, resolvedResult)
					},
					(e) => {
						sendError(res, e)
					}
				)
			} else {
				sendResult(res, 200, result)
			}
		} catch (e) {
			sendError(res, e)
		}
	})
}

PickerGET.route('/api', (params, req: IncomingMessage, res: ServerResponse) => {
	res.statusCode = 301
	res.setHeader('Location', '/api/0') // redirect to latest API version
	res.end()
})
PickerGET.route('/api/0', (params, req: IncomingMessage, res: ServerResponse) => {
	res.setHeader('Content-Type', 'application/json')
	res.statusCode = 200
	res.end(JSON.stringify(index, undefined, 2))
})
