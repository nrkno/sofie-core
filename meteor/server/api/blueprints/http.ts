import * as _ from 'underscore'
import { logger } from '../../logging'
import { Meteor } from 'meteor/meteor'
import { BlueprintManifestSet } from 'tv-automation-sofie-blueprints-integration'
import { ServerResponse, IncomingMessage } from 'http'
// @ts-ignore Meteor package not recognized by Typescript
import { Picker } from 'meteor/meteorhacks:picker'
import * as bodyParser from 'body-parser'
import { check, Match } from 'meteor/check'
import { parse as parseUrl } from 'url'
import { uploadBlueprint } from './api'

const postJsRoute = Picker.filter((req, res) => req.method === 'POST')
postJsRoute.middleware(bodyParser.text({
	type: 'text/javascript',
	limit: '1mb'
}))
postJsRoute.route('/blueprints/restore/:blueprintId', (params, req: IncomingMessage, res: ServerResponse, next) => {
	res.setHeader('Content-Type', 'text/plain')

	const blueprintId = params.blueprintId
	const url = parseUrl(req.url || '', true)

	const blueprintNames = url.query['name'] || undefined
	const blueprintName: string | undefined = (
		_.isArray(blueprintNames) ?
		blueprintNames[0] :
		blueprintNames
	)

	check(blueprintId, String)
	check(blueprintName, Match.Maybe(String))

	let content = ''
	try {
		const body = (req as any).body as string | undefined
		if (!body) throw new Meteor.Error(400, 'Restore Blueprint: Missing request body')

		if (!_.isString(body) || body.length < 10) throw new Meteor.Error(400, 'Restore Blueprint: Invalid request body')

		uploadBlueprint(blueprintId, body, blueprintName)

		res.statusCode = 200
	} catch (e) {
		res.statusCode = 500
		content = e + ''
		logger.error('Blueprint restore failed: ' + e)
	}

	res.end(content)
})
const postJsonRoute = Picker.filter((req, res) => req.method === 'POST')
postJsonRoute.middleware(bodyParser.text({
	type: 'application/json',
	limit: '10mb'
}))
postJsonRoute.route('/blueprints/restore', (params, req: IncomingMessage, res: ServerResponse, next) => {
	res.setHeader('Content-Type', 'text/plain')

	let content = ''
	try {
		const body = (req as any).body
		if (!body) throw new Meteor.Error(400, 'Restore Blueprint: Missing request body')

		let collection = body
		if (_.isString(body)) {
			if (body.length < 10) throw new Meteor.Error(400, 'Restore Blueprint: Invalid request body')
			try {
				collection = JSON.parse(body) as BlueprintManifestSet
			} catch (e) {
				throw new Meteor.Error(400, 'Restore Blueprint: Failed to parse request body')
			}
		} else if (!_.isObject(body)) {
			throw new Meteor.Error(400, 'Restore Blueprint: Invalid request body')
		}

		logger.info(`Got blueprint collection. ${Object.keys(body).length} blueprints`)

		let errors: any[] = []
		for (const id of _.keys(collection)) {
			try {
				uploadBlueprint(id, collection[id], id)
			} catch (e) {
				logger.error('Blueprint restore failed: ' + e)
				errors.push(e)
			}
		}

		// Report errors
		if (errors.length > 0) {
			res.statusCode = 500
			content += 'Errors were encountered: \n'
			for (const e of errors) {
				content += e + '\n'
			}
		} else {
			res.statusCode = 200
		}

	} catch (e) {
		res.statusCode = 500
		content = e + ''
		logger.error('Blueprint restore failed: ' + e)
	}

	res.end(content)
})
