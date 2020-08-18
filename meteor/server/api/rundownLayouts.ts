import { IncomingMessage, ServerResponse } from 'http'
import { Meteor } from 'meteor/meteor'
import { MethodContext, MethodContextAPI } from '../../lib/api/methods'
import { NewRundownLayoutsAPI, RundownLayoutsAPIMethods } from '../../lib/api/rundownLayouts'
import { check, Match } from '../../lib/check'
import { BlueprintId } from '../../lib/collections/Blueprints'
import {
	RundownLayoutBase,
	RundownLayoutId,
	RundownLayouts,
	RundownLayoutType,
} from '../../lib/collections/RundownLayouts'
import { ShowStyleBaseId, ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { UserId } from '../../lib/collections/Users'
import { getRandomId, literal, makePromise, protectString } from '../../lib/lib'
import { logger } from '../logging'
import { registerClassToMeteorMethods } from '../methods'
import { ShowStyleContentWriteAccess } from '../security/showStyle'
import { PickerGET, PickerPOST } from './http'

export function createRundownLayout(
	name: string,
	type: RundownLayoutType,
	showStyleBaseId: ShowStyleBaseId,
	blueprintId: BlueprintId | undefined,
	userId?: UserId | undefined,
	exposeAsStandalone?: boolean,
	exposeAsShelf?: boolean
) {
	const id: RundownLayoutId = getRandomId()
	RundownLayouts.insert(
		literal<RundownLayoutBase>({
			_id: id,
			name,
			showStyleBaseId,
			blueprintId,
			filters: [],
			type,
			userId,
			exposeAsStandalone: !!exposeAsStandalone,
			exposeAsShelf: !!exposeAsShelf,
			icon: '',
			iconColor: '#ffffff',
		})
	)
	return id
}

export function removeRundownLayout(layoutId: RundownLayoutId) {
	RundownLayouts.remove(layoutId)
}

PickerPOST.route('/shelfLayouts/upload/:showStyleBaseId', (params, req: IncomingMessage, res: ServerResponse, next) => {
	res.setHeader('Content-Type', 'text/plain')

	const showStyleBaseId: ShowStyleBaseId = protectString(params.showStyleBaseId)

	check(showStyleBaseId, String)

	const showStyleBase = ShowStyleBases.findOne(showStyleBaseId)

	let content = ''
	try {
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStylebase "${showStyleBaseId}" not found`)

		const body = req.body
		if (!body) throw new Meteor.Error(400, 'Restore Shelf Layout: Missing request body')

		if (typeof body !== 'string' || body.length < 10)
			throw new Meteor.Error(400, 'Restore Shelf Layout: Invalid request body')

		const layout = JSON.parse(body) as RundownLayoutBase
		check(layout._id, Match.Optional(String))
		check(layout.name, String)
		check(layout.filters, Array)
		check(layout.type, String)

		layout.showStyleBaseId = showStyleBase._id

		RundownLayouts.upsert(layout._id, layout)

		res.statusCode = 200
	} catch (e) {
		res.statusCode = 500
		content = e + ''
		logger.error('Shelf Layout restore failed: ' + e)
	}

	res.end(content)
})

PickerGET.route('/shelfLayouts/download/:id', (params, req: IncomingMessage, res: ServerResponse, next) => {
	let layoutId: RundownLayoutId = protectString(params.id)

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

/** Add RundownLayout into showStyleBase */
function apiCreateRundownLayout(
	context: MethodContext,
	name: string,
	type: RundownLayoutType,
	showStyleBaseId: ShowStyleBaseId
) {
	check(name, String)
	check(type, String)
	check(showStyleBaseId, String)

	const access = ShowStyleContentWriteAccess.anyContent(context, showStyleBaseId)

	return createRundownLayout(name, type, showStyleBaseId, undefined, access.userId || undefined)
}
function apiRemoveRundownLayout(context: MethodContext, id: RundownLayoutId) {
	check(id, String)

	const access = ShowStyleContentWriteAccess.rundownLayout(context, id)
	const rundownLayout = access.rundownLayout
	if (!rundownLayout) throw new Meteor.Error(404, `RundownLayout "${id}" not found`)

	removeRundownLayout(id)
}

class ServerRundownLayoutsAPI extends MethodContextAPI implements NewRundownLayoutsAPI {
	createRundownLayout(name: string, type: RundownLayoutType, showStyleBaseId: ShowStyleBaseId) {
		return makePromise(() => apiCreateRundownLayout(this, name, type, showStyleBaseId))
	}
	removeRundownLayout(rundownLayoutId: RundownLayoutId) {
		return makePromise(() => apiRemoveRundownLayout(this, rundownLayoutId))
	}
}
registerClassToMeteorMethods(
	RundownLayoutsAPIMethods,
	ServerRundownLayoutsAPI,
	false,
	(methodContext: MethodContext, methodName: string, args: any[], fcn: Function) => {
		return fcn.apply(methodContext, args)
	}
)
