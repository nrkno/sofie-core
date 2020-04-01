import { Random } from 'meteor/random'
import { Meteor } from 'meteor/meteor'
import { check, Match } from 'meteor/check'
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
	userId?: string | undefined,
	exposeAsStandalone?: boolean,
	exposeAsShelf?: boolean
) {
	RundownLayouts.insert(literal<RundownLayoutBase>({
		_id: Random.id(),
		name,
		showStyleBaseId,
		blueprintId,
		filters: [],
		type,
		userId,
		exposeAsStandalone: !!exposeAsStandalone,
		exposeAsShelf: !!exposeAsShelf,
		color: '#ffffff'
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
postJsRoute.route('/shelfLayouts/upload/:showStyleBaseId', (params, req: IncomingMessage, res: ServerResponse, next) => {
	res.setHeader('Content-Type', 'text/plain')

	const showStyleBaseId = params.showStyleBaseId

	const showStyleBase = ShowStyleBases.findOne(showStyleBaseId)
	if (!showStyleBase) {
		throw new Error(`ShowStylebase "${showStyleBaseId}" not found`)
	}

	let content = ''
	try {
		const body = (req as any).body
		if (!body) throw new Meteor.Error(400, 'Restore Shelf Layout: Missing request body')

		if (typeof body !== 'string' || body.length < 10) throw new Meteor.Error(400, 'Restore Shelf Layout: Invalid request body')

		const layout = JSON.parse(body) as RundownLayoutBase
		check(layout._id, Match.Optional(String))
		check(layout.name, String)
		check(layout.filters, Array)
		check(layout.showStyleBaseId, String)
		check(layout.type, String)

		layout.showStyleBaseId = showStyleBase._id

		RundownLayouts.upsert(layout._id, layout)

		res.statusCode = 200
	} catch (e) {
		res.statusCode = 500
		content = e + ''
		logger.error('Shlf Layout restore failed: ' + e)
	}

	res.end(content)
})

const getJsRoute = Picker.filter((req, res) => req.method === 'GET')
getJsRoute.route('/shelfLayouts/download/:id', (params, req: IncomingMessage, res: ServerResponse, next) => {
	let layoutId = params.id

	check(layoutId, String)

	let content = ''
	const layout = RundownLayouts.findOne(layoutId)
	if (!layout) {
		res.statusCode = 404
		content = 'Shelf Layout not found'
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
		logger.error('Shelf layout restore failed: ' + e)
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
