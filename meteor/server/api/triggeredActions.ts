import { Meteor } from 'meteor/meteor'
import { check, Match } from '../../lib/check'
import { registerClassToMeteorMethods, ReplaceOptionalWithNullInMethodArguments } from '../methods'
import { literal, getRandomId, protectString, unprotectString, Complete } from '../../lib/lib'
import { ServerResponse, IncomingMessage } from 'http'
import { logger } from '../logging'
import { MethodContext, MethodContextAPI } from '../../lib/api/methods'
import { ShowStyleContentWriteAccess } from '../security/showStyle'
import { PickerPOST, PickerGET } from './http'
import { DBTriggeredActions, TriggeredActionsObj } from '../../lib/collections/TriggeredActions'
import {
	CreateTriggeredActionsContent,
	NewTriggeredActionsAPI,
	TriggeredActionsAPIMethods,
} from '../../lib/api/triggeredActions'
import { SystemWriteAccess } from '../security/system'
import { fetchShowStyleBaseLight } from '../optimizations'
import {
	convertObjectIntoOverrides,
	wrapDefaultObject,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ShowStyleBaseId, TriggeredActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { TriggeredActions } from '../collections'

export async function createTriggeredActions(
	showStyleBaseId: ShowStyleBaseId | null,
	base?: CreateTriggeredActionsContent
): Promise<TriggeredActionId> {
	const id: TriggeredActionId = getRandomId()
	await TriggeredActions.insertAsync(
		literal<Complete<TriggeredActionsObj>>({
			_id: id,
			_rank: base?._rank ?? 0,
			name: base?.name,
			showStyleBaseId,
			blueprintUniqueId: null,
			// User source objects should be formed purely of overrides
			actionsWithOverrides: convertObjectIntoOverrides(base?.actions),
			triggersWithOverrides: convertObjectIntoOverrides(base?.triggers),
		})
	)
	return id
}

export async function removeTriggeredActions(triggeredActionId: TriggeredActionId): Promise<void> {
	await TriggeredActions.removeAsync(triggeredActionId)
}

PickerPOST.route(
	'/actionTriggers/upload/:showStyleBaseId?',
	async (params, req: IncomingMessage, res: ServerResponse) => {
		res.setHeader('Content-Type', 'text/plain')

		const showStyleBaseId: ShowStyleBaseId | undefined = protectString(params.showStyleBaseId) as
			| ShowStyleBaseId
			| undefined

		check(showStyleBaseId, Match.Optional(String))
		let content = ''

		const replace: boolean = params.query === 'replace'

		try {
			if (showStyleBaseId !== undefined) {
				const showStyleBase = await fetchShowStyleBaseLight(showStyleBaseId)
				if (!showStyleBase) {
					throw new Meteor.Error(
						404,
						`Restore Action Triggers: ShowStyle "${showStyleBaseId}" could not be found`
					)
				}
			}

			const body = req.body
			if (!body) throw new Meteor.Error(400, 'Restore Action Triggers: Missing request body')

			if (typeof body !== 'string' || body.length < 10)
				throw new Meteor.Error(400, 'Restore Action Triggers: Invalid request body')

			const triggeredActions = JSON.parse(body) as DBTriggeredActions[]
			check(triggeredActions, Array)

			// set new showStyleBaseId
			for (let i = 0; i < triggeredActions.length; i++) {
				const compatObj = triggeredActions[i] as any
				if ('triggers' in compatObj) {
					triggeredActions[i].triggersWithOverrides = wrapDefaultObject(compatObj.triggers)
					delete compatObj.triggers
				}
				if ('actions' in compatObj) {
					triggeredActions[i].actionsWithOverrides = wrapDefaultObject(compatObj.actions)
					delete compatObj.actions
				}

				check(triggeredActions[i]._id, String)
				check(triggeredActions[i].name, Match.Optional(Match.OneOf(String, Object)))
				check(triggeredActions[i].triggersWithOverrides, Object)
				check(triggeredActions[i].actionsWithOverrides, Object)
				triggeredActions[i].showStyleBaseId = showStyleBaseId ?? null
			}

			if (replace) {
				await TriggeredActions.removeAsync({
					showStyleBaseId: showStyleBaseId ?? null,
				})
			}

			// TODO - should we clear `blueprintUniqueId`, to avoid blueprints getting them confused with data they own?

			await TriggeredActions.upsertManyAsync(triggeredActions)

			res.statusCode = 200
		} catch (e) {
			res.statusCode = 500
			content = e + ''
			logger.error('Triggered Actions restore failed: ' + e)
		}

		res.end(content)
	}
)

PickerGET.route(
	'/actionTriggers/download/:showStyleBaseId?',
	async (params, _req: IncomingMessage, res: ServerResponse) => {
		const showStyleBaseId: ShowStyleBaseId | undefined = protectString(params.showStyleBaseId)

		check(showStyleBaseId, Match.Maybe(String))

		let content = ''
		const triggeredActions = await TriggeredActions.findFetchAsync({
			showStyleBaseId: showStyleBaseId === undefined ? null : showStyleBaseId,
		})
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
				`attachment; filename*=UTF-8''${encodeURIComponent(
					unprotectString(showStyleBaseId) ?? 'system-wide'
				)}.json`
			)
			res.setHeader('Content-Type', 'application/json')
			res.statusCode = 200
		} catch (e) {
			res.statusCode = 500
			content = e + ''
			logger.error('Action Triggers export failed: ' + e)
		}

		res.end(content)
	}
)

/** Add RundownLayout into showStyleBase */
async function apiCreateTriggeredActions(
	context: MethodContext,
	showStyleBaseId: ShowStyleBaseId | null,
	base: CreateTriggeredActionsContent | null
) {
	check(showStyleBaseId, Match.Maybe(String))
	check(base, Match.Maybe(Object))

	if (!showStyleBaseId) {
		const access = await SystemWriteAccess.coreSystem(context)
		if (!access) throw new Meteor.Error(403, `Core System settings not writable`)
	} else {
		const access = await ShowStyleContentWriteAccess.anyContent(context, showStyleBaseId)
		if (!access) throw new Meteor.Error(404, `ShowStyleBase "${showStyleBaseId}" not found`)
	}

	return createTriggeredActions(showStyleBaseId, base || undefined)
}
async function apiRemoveTriggeredActions(context: MethodContext, id: TriggeredActionId) {
	check(id, String)

	const access = await ShowStyleContentWriteAccess.triggeredActions(context, id)
	const triggeredActions = typeof access === 'boolean' ? access : access.triggeredActions
	if (!triggeredActions) throw new Meteor.Error(404, `Action Trigger "${id}" not found`)

	await removeTriggeredActions(id)
}

class ServerTriggeredActionsAPI
	extends MethodContextAPI
	implements ReplaceOptionalWithNullInMethodArguments<NewTriggeredActionsAPI>
{
	async createTriggeredActions(showStyleBaseId: ShowStyleBaseId | null, base: CreateTriggeredActionsContent | null) {
		return apiCreateTriggeredActions(this, showStyleBaseId, base)
	}
	async removeTriggeredActions(triggeredActionId: TriggeredActionId) {
		return apiRemoveTriggeredActions(this, triggeredActionId)
	}
}
registerClassToMeteorMethods(TriggeredActionsAPIMethods, ServerTriggeredActionsAPI, false)
