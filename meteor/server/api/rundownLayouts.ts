import { Random } from 'meteor/random'
import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { ClientAPI } from '../../lib/api/client'
import { setMeteorMethods, Methods } from '../methods'
import { RundownLayoutsAPI } from '../../lib/api/rundownLayouts'
import { RundownLayouts, RundownLayoutType, RundownLayoutBase } from '../../lib/collections/RundownLayouts'
import { literal } from '../../lib/lib'
import { RundownLayoutSecurity } from '../security/rundownLayouts'
import { ServerResponse, IncomingMessage } from 'http'
import { logger } from '../logging'
// @ts-ignore Meteor package not recognized by Typescript
import { Picker } from 'meteor/meteorhacks:picker'
import * as bodyParser from 'body-parser'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'

export function createRundownLayout (
	name: string,
	type: RundownLayoutType,
	showStyleBaseId: string,
	blueprintId: string | undefined,
	userId?: string | undefined
) {
	RundownLayouts.insert(literal<RundownLayoutBase>({
		_id: Random.id(),
		name,
		showStyleBaseId,
		blueprintId,
		filters: [],
		type,
		userId
	}))
}

export function removeRundownLayout (id: string) {
	RundownLayouts.remove(id)
}

const postJsRoute = Picker.filter((req, res) => req.method === 'POST')
postJsRoute.middleware(bodyParser.text({
	type: 'text/javascript',
	limit: '1mb'
}))
postJsRoute.route('/rundownLayouts', (params, req: IncomingMessage, res: ServerResponse, next) => {
	res.setHeader('Content-Type', 'text/plain')

	let content = ''
	try {
		const body = (req as any).body
		if (!body) throw new Meteor.Error(400, 'Restore Rundown Layout: Missing request body')

		if (typeof body !== 'string' || body.length < 10) throw new Meteor.Error(400, 'Restore Rundown Layout: Invalid request body')

		const layout = JSON.parse(body) as RundownLayoutBase
		check(layout._id, String)
		check(layout.name, String)
		check(layout.filters, Array)
		check(layout.showStyleBaseId, String)
		check(layout.type, String)

		if (ShowStyleBases.findOne(layout.showStyleBaseId) === undefined) {
			throw new Error(`Unsupported showStyleBase: ${layout.showStyleBaseId}`)
		}

		RundownLayouts.upsert(layout._id, layout)

		res.statusCode = 200
	} catch (e) {
		res.statusCode = 500
		content = e + ''
		logger.error('Rundown Layout restore failed: ' + e)
	}

	res.end(content)
})

const getJsRoute = Picker.filter((req, res) => req.method === 'GET')
getJsRoute.route('/rundownLayouts/:id', (params, req: IncomingMessage, res: ServerResponse, next) => {
	let layoutId = params.id

	check(layoutId, String)

	let content = ''
	const layout = RundownLayouts.findOne(layoutId)
	if (!layout) {
		res.statusCode = 404
		content = 'Rundown Layout not found'
		res.end(content)
		return
	}

	try {
		content = JSON.stringify(layout, undefined, 2)
		res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(layout.name)}.json`)
		res.setHeader('Content-Type', 'application/json')
		res.statusCode = 200
	} catch (e) {
		res.statusCode = 500
		content = e + ''
		logger.error('Rundown layout restore failed: ' + e)
	}

	res.end(content)
})

let methods: Methods = {}
methods[RundownLayoutsAPI.methods.createRundownLayout] =
function (name: string, type: RundownLayoutType, showStyleBaseId: string) {
	check(name, String)
	check(type, String)
	check(showStyleBaseId, String)

	createRundownLayout(name, type, showStyleBaseId, undefined, this.connection.userId)
	return ClientAPI.responseSuccess()
}
methods[RundownLayoutsAPI.methods.removeRundownLayout] =
function (id: string) {
	check(id, String)

	if (RundownLayoutSecurity.allowWriteAccess(this.connection.userId)) {
		removeRundownLayout(id)
		return ClientAPI.responseSuccess()
	}
	throw new Meteor.Error(403, 'Access denied')
}
// Apply methods:
setMeteorMethods(methods)
