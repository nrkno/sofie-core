import { Meteor } from 'meteor/meteor'
import { check, Match } from '../../lib/check'
import { registerClassToMeteorMethods } from '../methods'
import { literal, getRandomId, protectString, makePromise, unprotectString } from '../../lib/lib'
import { ServerResponse, IncomingMessage } from 'http'
import { logger } from '../logging'
import { ShowStyleBases, ShowStyleBaseId } from '../../lib/collections/ShowStyleBases'
import { MethodContext, MethodContextAPI } from '../../lib/api/methods'
import { ShowStyleContentWriteAccess } from '../security/showStyle'
import { PickerPOST, PickerGET } from './http'
import {
	DBTriggeredActions,
	TriggeredActionId,
	TriggeredActions,
	TriggeredActionsObj,
} from '../../lib/collections/TriggeredActions'
import { NewTriggeredActionsAPI, TriggeredActionsAPIMethods } from '../../lib/api/triggeredActions'

export function createTriggeredActions(
	showStyleBaseId: ShowStyleBaseId,
	base?: Partial<Pick<DBTriggeredActions, 'triggers' | 'actions' | 'name'>>
) {
	const id: TriggeredActionId = getRandomId()
	TriggeredActions.insert(
		literal<TriggeredActionsObj>({
			_id: id,
			name: base?.name,
			showStyleBaseId,
			_rundownVersionHash: '',
			actions: base?.actions ?? [],
			triggers: base?.triggers ?? [],
		})
	)
	return id
}

export function removeTriggeredActions(triggeredActionId: TriggeredActionId) {
	TriggeredActions.remove(triggeredActionId)
}

PickerPOST.route('/actionTriggers/upload/:showStyleBaseId?', (params, req: IncomingMessage, res: ServerResponse) => {
	res.setHeader('Content-Type', 'text/plain')

	const showStyleBaseId: ShowStyleBaseId | undefined = protectString(params.showStyleBaseId)

	check(showStyleBaseId, String)

	const showStyleBase = ShowStyleBases.findOne(showStyleBaseId)

	let content = ''
	try {
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStylebase "${showStyleBaseId}" not found`)

		const body = req.body
		if (!body) throw new Meteor.Error(400, 'Restore Shelf Layout: Missing request body')

		if (typeof body !== 'string' || body.length < 10)
			throw new Meteor.Error(400, 'Restore Shelf Layout: Invalid request body')

		const triggeredActions = JSON.parse(body) as DBTriggeredActions[]
		check(triggeredActions, Array)

		// set new showStyleBaseId
		for (let i = 0; i < triggeredActions.length; i++) {
			check(triggeredActions[i]._id, String)
			check(triggeredActions[i].name, Match.Optional(String))
			check(triggeredActions[i].triggers, Array)
			check(triggeredActions[i].actions, Array)
			triggeredActions[i].showStyleBaseId = showStyleBaseId
			triggeredActions[i]._rundownVersionHash = ''
		}

		for (let i = 0; i < triggeredActions.length; i++) {
			TriggeredActions.upsert(triggeredActions[i]._id, triggeredActions[i])
		}

		res.statusCode = 200
	} catch (e) {
		res.statusCode = 500
		content = e + ''
		logger.error('Triggered Actions restore failed: ' + e)
	}

	res.end(content)
})

PickerGET.route('/actionTriggers/download/:showStyleBaseId?', (params, req: IncomingMessage, res: ServerResponse) => {
	const showStyleBaseId: ShowStyleBaseId | undefined = protectString(params.showStyleBaseId)

	check(showStyleBaseId, String)

	let content = ''
	const triggeredActions = TriggeredActions.find({
		showStyleBaseId:
			showStyleBaseId === undefined
				? {
						$exists: false,
				  }
				: showStyleBaseId,
	}).fetch()
	if (triggeredActions.length === 0) {
		res.statusCode = 404
		content = `Action Triggers not found for showstyle "${showStyleBaseId}"`
		res.end(content)
		return
	}

	try {
		content = JSON.stringify(triggeredActions, undefined, 2)
		res.setHeader(
			'Content-Disposition',
			`attachment; filename*=UTF-8''${encodeURIComponent(unprotectString(showStyleBaseId))}.json`
		)
		res.setHeader('Content-Type', 'application/json')
		res.statusCode = 200
	} catch (e) {
		res.statusCode = 500
		content = e + ''
		logger.error('Action Triggers export failed: ' + e)
	}

	res.end(content)
})

/** Add RundownLayout into showStyleBase */
function apiCreateTriggeredActions(
	context: MethodContext,
	showStyleBaseId: ShowStyleBaseId,
	base?: Partial<Pick<DBTriggeredActions, 'triggers' | 'actions' | 'name'>>
) {
	check(showStyleBaseId, String)
	check(base, Match.Optional(Object))

	return createTriggeredActions(showStyleBaseId, base)
}
function apiRemoveTriggeredActions(context: MethodContext, id: TriggeredActionId) {
	check(id, String)

	const access = ShowStyleContentWriteAccess.triggeredActions(context, id)
	const triggeredActions = access === true ? access : access.triggeredActions
	if (!triggeredActions) throw new Meteor.Error(404, `RundownLayout "${id}" not found`)

	removeTriggeredActions(id)
}

class ServerTriggeredActionsAPI extends MethodContextAPI implements NewTriggeredActionsAPI {
	async createTriggeredActions(
		showStyleBaseId: ShowStyleBaseId,
		base?: Partial<Pick<DBTriggeredActions, 'triggers' | 'actions' | 'name'>>
	) {
		return makePromise(() => apiCreateTriggeredActions(this, showStyleBaseId, base))
	}
	async removeTriggeredActions(triggeredActionsId: TriggeredActionId) {
		return makePromise(() => apiRemoveTriggeredActions(this, triggeredActionsId))
	}
}
registerClassToMeteorMethods(
	TriggeredActionsAPIMethods,
	ServerTriggeredActionsAPI,
	false,
	(methodContext: MethodContext, methodName: string, args: any[], fcn: Function) => {
		return fcn.apply(methodContext, args)
	}
)
