import Koa from 'koa'
import cors from '@koa/cors'
import KoaRouter from '@koa/router'
import { logger } from '../../logging'
import { WebApp } from 'meteor/webapp'
import { check, Match } from '../../../lib/check'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '../../../lib/api/client'
import { getCurrentTime, getRandomString, protectString } from '../../../lib/lib'
import { RestAPI, RestAPIMethods } from '../../../lib/api/rest'
import { registerClassToMeteorMethods, ReplaceOptionalWithNullInMethodArguments } from '../../methods'
import { RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { MeteorCall, MethodContextAPI } from '../../../lib/api/methods'
import { ServerClientAPI } from '../client'
import { ServerRundownAPI } from '../rundown'
import { triggerWriteAccess } from '../../security/lib/securityVerify'
import { ExecuteActionResult, StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { CURRENT_SYSTEM_VERSION } from '../../migration/currentSystemVersion'
import {
	AdLibActionId,
	BucketAdLibId,
	PartId,
	PartInstanceId,
	PieceId,
	RundownBaselineAdLibActionId,
	RundownPlaylistId,
	SegmentId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { AdLibPieces } from '../../../lib/collections/AdLibPieces'
import { AdLibActions } from '../../../lib/collections/AdLibActions'
import { RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { RundownBaselineAdLibActions } from '../../../lib/collections/RundownBaselineAdLibActions'
import { BucketAdLibs } from '../../../lib/collections/BucketAdlibs'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { StudioContentWriteAccess } from '../../security/studio'
import { ServerPlayoutAPI } from '../playout/playout'
import { TriggerReloadDataResponse } from '../../../lib/api/userActions'

function restAPIUserEvent(
	ctx: Koa.ParameterizedContext<
		Koa.DefaultState,
		Koa.DefaultContext & KoaRouter.RouterParamContext<Koa.DefaultState, Koa.DefaultContext>,
		unknown
	>
): string {
	return `rest_api_${ctx.method}_${ctx.URL.toString()}`
}

class ServerRestAPI extends MethodContextAPI implements ReplaceOptionalWithNullInMethodArguments<RestAPI> {
	async index(): Promise<ClientAPI.ClientResponse<{ version: string }>> {
		triggerWriteAccess()

		return ClientAPI.responseSuccess({ version: CURRENT_SYSTEM_VERSION })
	}
	async activate(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		rehearsal: boolean
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			{ ...this, connection: connection },
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(rehearsal, Boolean)
			},
			StudioJobs.ActivateRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
				rehearsal,
			}
		)
	}
	async deactivate(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			{ ...this, connection: connection },
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.DeactivateRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async executeAction(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		actionId: string,
		userData: any
	): Promise<ClientAPI.ClientResponse<ExecuteActionResult>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			{ ...this, connection: connection },
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(actionId, String)
			},
			StudioJobs.ExecuteAction,
			{
				playlistId: rundownPlaylistId,
				actionDocId: null,
				actionId,
				userData,
			}
		)
	}
	async executeAdLib(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		adLibId: AdLibActionId | RundownBaselineAdLibActionId | PieceId | BucketAdLibId,
		triggerMode?: string | null
	): Promise<ClientAPI.ClientResponse<object>> {
		const baselineAdLibPiece = RundownBaselineAdLibPieces.findOneAsync(adLibId as PieceId, {
			projection: { _id: 1 },
		})
		const segmentAdLibPiece = AdLibPieces.findOneAsync(adLibId as PieceId, { projection: { _id: 1 } })
		const bucketAdLibPiece = BucketAdLibs.findOneAsync(adLibId as BucketAdLibId, { projection: { _id: 1 } })
		const [baselineAdLibDoc, segmentAdLibDoc, bucketAdLibDoc, adLibAction, baselineAdLibAction] = await Promise.all(
			[
				baselineAdLibPiece,
				segmentAdLibPiece,
				bucketAdLibPiece,
				AdLibActions.findOneAsync(adLibId as AdLibActionId, {
					projection: { _id: 1, actionId: 1, userData: 1 },
				}),
				RundownBaselineAdLibActions.findOneAsync(adLibId as RundownBaselineAdLibActionId, {
					projection: { _id: 1, actionId: 1, userData: 1 },
				}),
			]
		)
		const adLibActionDoc = adLibAction ?? baselineAdLibAction
		const regularAdLibDoc = baselineAdLibDoc ?? segmentAdLibDoc ?? bucketAdLibDoc
		if (regularAdLibDoc) {
			// This is an AdLib Piece
			const pieceType = baselineAdLibDoc ? 'baseline' : segmentAdLibDoc ? 'normal' : 'bucket'
			const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId, {
				projection: { currentPartInstanceId: 1 },
			})
			if (!rundownPlaylist) throw new Error(`Rundown playlist ${rundownPlaylistId} does not exist`)
			if (rundownPlaylist.currentPartInstanceId === null)
				throw new Error(`No active Part in ${rundownPlaylistId}`)

			const result = await ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
				{ ...this, connection: connection },
				event,
				getCurrentTime(),
				rundownPlaylistId,
				() => {
					check(rundownPlaylistId, String)
					check(adLibId, Match.OneOf(String, null))
				},
				StudioJobs.AdlibPieceStart,
				{
					playlistId: rundownPlaylistId,
					adLibPieceId: regularAdLibDoc._id,
					partInstanceId: rundownPlaylist.currentPartInstanceId,
					pieceType,
				}
			)
			if (ClientAPI.isClientResponseError(result)) return result
			return ClientAPI.responseSuccess({})
		} else if (adLibActionDoc) {
			// This is an AdLib Action
			return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
				{ ...this, connection: connection },
				event,
				getCurrentTime(),
				rundownPlaylistId,
				() => {
					check(rundownPlaylistId, String)
					check(adLibId, Match.OneOf(String, null))
				},
				StudioJobs.ExecuteAction,
				{
					playlistId: rundownPlaylistId,
					actionDocId: adLibActionDoc._id,
					actionId: adLibActionDoc.actionId,
					userData: adLibActionDoc.userData,
					triggerMode: triggerMode ? triggerMode : undefined,
				}
			)
		} else {
			return ClientAPI.responseError(
				UserError.from(new Error(`No adLib with Id ${adLibId}`), UserErrorMessage.AdlibNotFound)
			)
		}
	}
	async moveNextPart(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		delta: number
	): Promise<ClientAPI.ClientResponse<PartId | null>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			{ ...this, connection: connection },
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(delta, Number)
			},
			StudioJobs.MoveNextPart,
			{
				playlistId: rundownPlaylistId,
				partDelta: delta,
				segmentDelta: 0,
			}
		)
	}
	async moveNextSegment(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		delta: number
	): Promise<ClientAPI.ClientResponse<PartId | null>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			{ ...this, connection: connection },
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(delta, Number)
			},
			StudioJobs.MoveNextPart,
			{
				playlistId: rundownPlaylistId,
				partDelta: 0,
				segmentDelta: delta,
			}
		)
	}

	async reloadPlaylist(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<object>> {
		return ServerClientAPI.runUserActionInLogForPlaylist<object>(
			{ ...this, connection: connection },
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			'reloadPlaylist',
			[rundownPlaylistId],
			async (access) => {
				const reloadResponse = await ServerRundownAPI.resyncRundownPlaylist(access)
				const success = !reloadResponse.rundownsResponses.reduce((missing, rundownsResponse) => {
					return missing || rundownsResponse.response === TriggerReloadDataResponse.MISSING
				}, false)
				return success
					? {}
					: UserError.from(
							new Error(`Failed to reload playlist ${rundownPlaylistId}`),
							UserErrorMessage.InternalError
					  )
			}
		)
	}

	async resetPlaylist(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			{ ...this, connection: connection },
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.ResetRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async setNextSegment(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		segmentId: SegmentId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			{ ...this, connection: connection },
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(segmentId, String)
			},
			StudioJobs.SetNextSegment,
			{
				playlistId: rundownPlaylistId,
				nextSegmentId: segmentId,
			}
		)
	}
	async setNextPart(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		partId: PartId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			{ ...this, connection: connection },
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(partId, String)
			},
			StudioJobs.SetNextPart,
			{
				playlistId: rundownPlaylistId,
				nextPartId: partId,
			}
		)
	}

	async take(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		fromPartInstanceId?: PartInstanceId
	): Promise<ClientAPI.ClientResponse<void>> {
		triggerWriteAccess()
		const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId)
		if (!rundownPlaylist) throw new Error(`Rundown playlist ${rundownPlaylistId} does not exist`)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			{ ...this, connection: connection },
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.TakeNextPart,
			{
				playlistId: rundownPlaylistId,
				fromPartInstanceId: fromPartInstanceId ?? rundownPlaylist.currentPartInstanceId,
			}
		)
	}

	async switchRouteSet(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId,
		routeSetId: string,
		state: boolean
	) {
		return ServerClientAPI.runUserActionInLog(
			{ ...this, connection: connection },
			event,
			getCurrentTime(),
			'switchRouteSet',
			[studioId, routeSetId, state],
			async () => {
				check(studioId, String)
				check(routeSetId, String)
				check(state, Boolean)

				const access = await StudioContentWriteAccess.routeSet(this, studioId)
				return ServerPlayoutAPI.switchRouteSet(access, routeSetId, state)
			}
		)
	}
}
registerClassToMeteorMethods(RestAPIMethods, ServerRestAPI, false)

const koaRouter = new KoaRouter()

koaRouter.get('/', async (ctx, next) => {
	ctx.type = 'application/json'
	ctx.body = ClientAPI.responseSuccess(await MeteorCall.rest.index())
	ctx.status = 200
	await next()
})

koaRouter.post('/activate/:playlistId', async (ctx, next) => {
	const rundownPlaylistId = protectString<RundownPlaylistId>(ctx.params.playlistId)
	const rehearsal = (ctx.req.body as { rehearsal: boolean }).rehearsal
	logger.info(`koa POST: activate ${rundownPlaylistId} - ${rehearsal ? 'rehearsal' : 'live'}`)

	try {
		check(rundownPlaylistId, String)
		ctx.body = ClientAPI.responseSuccess(
			await MeteorCall.rest.activate(makeConnection(ctx), restAPIUserEvent(ctx), rundownPlaylistId, rehearsal)
		)
		ctx.status = 200
	} catch (e) {
		const errMsg = UserError.isUserError(e) ? e.message.key : (e as Error).message
		logger.error('POST activate failed - ' + errMsg)
		ctx.type = 'application/json'
		ctx.body = JSON.stringify({ message: errMsg })
		ctx.status = 412
	}
	await next()
})

koaRouter.post('/deactivate/:playlistId', async (ctx, next) => {
	const rundownPlaylistId = protectString<RundownPlaylistId>(ctx.params.playlistId)
	logger.info(`koa POST: deactivate ${rundownPlaylistId}`)

	try {
		check(rundownPlaylistId, String)
		ctx.body = ClientAPI.responseSuccess(
			await MeteorCall.rest.deactivate(makeConnection(ctx), restAPIUserEvent(ctx), rundownPlaylistId)
		)
		ctx.status = 200
	} catch (e) {
		const errMsg = UserError.isUserError(e) ? e.message.key : (e as Error).message
		logger.error('POST deactivate failed - ' + errMsg)
		ctx.type = 'application/json'
		ctx.body = JSON.stringify({ message: errMsg })
		ctx.status = 412
	}
	await next()
})

koaRouter.post('/executeAdLib/:playlistId/:adLibId', async (ctx, next) => {
	const rundownPlaylistId = protectString<RundownPlaylistId>(ctx.params.playlistId)
	const adLibId = protectString<AdLibActionId | RundownBaselineAdLibActionId | PieceId | BucketAdLibId>(
		ctx.params.adLibId
	)
	const actionTypeObj = ctx.req.body
	const triggerMode = actionTypeObj ? (actionTypeObj as { actionType: string }).actionType : undefined
	logger.info(`koa POST: executeAdLib ${rundownPlaylistId} ${adLibId} - triggerMode: ${triggerMode}`)

	try {
		check(adLibId, String)
		check(rundownPlaylistId, String)
		ctx.body = ClientAPI.responseSuccess(
			await MeteorCall.rest.executeAdLib(
				makeConnection(ctx),
				restAPIUserEvent(ctx),
				rundownPlaylistId,
				adLibId,
				triggerMode
			)
		)
		ctx.status = 200
	} catch (e) {
		const errMsg = UserError.isUserError(e) ? e.message.key : (e as Error).message
		logger.error('POST executeAdLib failed - ' + errMsg)
		ctx.type = 'application/json'
		ctx.body = JSON.stringify({ message: errMsg })
		ctx.status = 412
	}
	await next()
})

koaRouter.post('/moveNextPart/:playlistId/:delta', async (ctx, next) => {
	const rundownPlaylistId = protectString<RundownPlaylistId>(ctx.params.playlistId)
	const delta = parseInt(ctx.params.delta)
	logger.info(`koa POST: moveNextPart ${rundownPlaylistId} ${delta}`)

	try {
		check(rundownPlaylistId, String)
		check(delta, Number)
		ctx.body = ClientAPI.responseSuccess(
			await MeteorCall.rest.moveNextPart(makeConnection(ctx), restAPIUserEvent(ctx), rundownPlaylistId, delta)
		)
		ctx.status = 200
	} catch (e) {
		const errMsg = UserError.isUserError(e) ? e.message.key : (e as Error).message
		logger.error('POST moveNextPart failed - ' + errMsg)
		ctx.type = 'application/json'
		ctx.body = JSON.stringify({ message: errMsg })
		ctx.status = 412
	}
	await next()
})

koaRouter.post('/moveNextSegment/:playlistId/:delta', async (ctx, next) => {
	const rundownPlaylistId = protectString<RundownPlaylistId>(ctx.params.playlistId)
	const delta = parseInt(ctx.params.delta)
	logger.info(`koa POST: moveNextSegment ${rundownPlaylistId} ${delta}`)

	try {
		check(rundownPlaylistId, String)
		check(delta, Number)
		ctx.body = ClientAPI.responseSuccess(
			await MeteorCall.rest.moveNextSegment(makeConnection(ctx), restAPIUserEvent(ctx), rundownPlaylistId, delta)
		)
		ctx.status = 200
	} catch (e) {
		const errMsg = UserError.isUserError(e) ? e.message.key : (e as Error).message
		logger.error('POST moveNextSegment failed - ' + errMsg)
		ctx.type = 'application/json'
		ctx.body = JSON.stringify({ message: errMsg })
		ctx.status = 412
	}
	await next()
})

koaRouter.post('/reloadPlaylist/:playlistId', async (ctx, next) => {
	const rundownPlaylistId = protectString<RundownPlaylistId>(ctx.params.playlistId)
	logger.info(`koa POST: reloadPlaylist ${rundownPlaylistId}`)

	try {
		check(rundownPlaylistId, String)
		ctx.body = ClientAPI.responseSuccess(
			await MeteorCall.rest.reloadPlaylist(makeConnection(ctx), restAPIUserEvent(ctx), rundownPlaylistId)
		)
		ctx.status = 200
	} catch (e) {
		const errMsg = UserError.isUserError(e) ? e.message.key : (e as Error).message
		logger.error('POST reloadPlaylist failed - ' + errMsg)
		ctx.type = 'application/json'
		ctx.body = JSON.stringify({ message: errMsg })
		ctx.status = 412
	}
	await next()
})

koaRouter.post('/resetPlaylist/:playlistId', async (ctx, next) => {
	const rundownPlaylistId = protectString<RundownPlaylistId>(ctx.params.playlistId)
	logger.info(`koa POST: resetPlaylist ${rundownPlaylistId}`)

	try {
		check(rundownPlaylistId, String)
		ctx.body = ClientAPI.responseSuccess(
			await MeteorCall.rest.resetPlaylist(makeConnection(ctx), restAPIUserEvent(ctx), rundownPlaylistId)
		)
		ctx.status = 200
	} catch (e) {
		const errMsg = UserError.isUserError(e) ? e.message.key : (e as Error).message
		logger.error('POST resetPlaylist failed - ' + errMsg)
		ctx.type = 'application/json'
		ctx.body = JSON.stringify({ message: errMsg })
		ctx.status = 412
	}
	await next()
})

koaRouter.post('/setNextPart/:playlistId/:partId', async (ctx, next) => {
	const rundownPlaylistId = protectString<RundownPlaylistId>(ctx.params.playlistId)
	const partId = protectString<PartId>(ctx.params.partId)
	logger.info(`koa POST: setNextPart ${rundownPlaylistId} ${partId}`)

	try {
		check(rundownPlaylistId, String)
		check(partId, String)
		ctx.body = ClientAPI.responseSuccess(
			await MeteorCall.rest.setNextPart(makeConnection(ctx), restAPIUserEvent(ctx), rundownPlaylistId, partId)
		)
		ctx.status = 200
	} catch (e) {
		const errMsg = UserError.isUserError(e) ? e.message.key : (e as Error).message
		logger.error('POST setNextPart failed - ' + errMsg)
		ctx.type = 'application/json'
		ctx.body = JSON.stringify({ message: errMsg })
		ctx.status = 412
	}
	await next()
})

koaRouter.post('/setNextSegment/:playlistId/:segmentId', async (ctx, next) => {
	const rundownPlaylistId = protectString<RundownPlaylistId>(ctx.params.playlistId)
	const segmentId = protectString<SegmentId>(ctx.params.segmentId)
	logger.info(`koa POST: setNextSegment ${rundownPlaylistId} ${segmentId}`)

	try {
		check(rundownPlaylistId, String)
		check(segmentId, String)
		ctx.body = ClientAPI.responseSuccess(
			await MeteorCall.rest.setNextSegment(
				makeConnection(ctx),
				restAPIUserEvent(ctx),
				rundownPlaylistId,
				segmentId
			)
		)
		ctx.status = 200
	} catch (e) {
		const errMsg = UserError.isUserError(e) ? e.message.key : (e as Error).message
		logger.error('POST setNextSegment failed - ' + errMsg)
		ctx.type = 'application/json'
		ctx.body = JSON.stringify({ message: errMsg })
		ctx.status = 412
	}
	await next()
})

koaRouter.post('/take/:playlistId', async (ctx, next) => {
	const rundownPlaylistId = protectString<RundownPlaylistId>(ctx.params.playlistId)
	const fromPartInstanceId = (ctx.req.body as { fromPartInstanceId: string }).fromPartInstanceId
	logger.info(`koa POST: take ${rundownPlaylistId}`)

	try {
		check(rundownPlaylistId, String)
		check(fromPartInstanceId, Match.Optional(String))
		ctx.body = ClientAPI.responseSuccess(
			await MeteorCall.rest.take(
				makeConnection(ctx),
				restAPIUserEvent(ctx),
				rundownPlaylistId,
				protectString(fromPartInstanceId)
			)
		)
		ctx.status = 200
	} catch (e) {
		const errMsg = UserError.isUserError(e) ? e.message.key : (e as Error).message
		logger.error('POST take failed - ' + errMsg)
		ctx.type = 'application/json'
		ctx.body = JSON.stringify({ message: errMsg })
		ctx.status = 412
	}
	await next()
})

koaRouter.post('/switchRouteSet/:studioId/:routeSetId', async (ctx, next) => {
	const studioId = protectString<StudioId>(ctx.params.studioId)
	const routeSetId = ctx.params.routeSetId
	const active = (ctx.req.body as { active: boolean }).active
	logger.info(`koa POST: switchRouteSet ${studioId} ${routeSetId} ${active}`)

	try {
		check(studioId, String)
		check(routeSetId, String)
		check(active, Boolean)
		ctx.body = ClientAPI.responseSuccess(
			await MeteorCall.rest.switchRouteSet(
				makeConnection(ctx),
				restAPIUserEvent(ctx),
				studioId,
				routeSetId,
				active
			)
		)
		ctx.status = 200
	} catch (e) {
		const errMsg = UserError.isUserError(e) ? e.message.key : (e as Error).message
		logger.error('POST switchRouteSet failed - ' + errMsg)
		ctx.type = 'application/json'
		ctx.body = JSON.stringify({ message: errMsg })
		ctx.status = 412
	}
	await next()
})

const makeConnection = (
	ctx: Koa.ParameterizedContext<
		Koa.DefaultState,
		Koa.DefaultContext & KoaRouter.RouterParamContext<Koa.DefaultState, Koa.DefaultContext>,
		unknown
	>
): Meteor.Connection => {
	return {
		id: getRandomString(),
		close: () => {},
		onClose: () => {},
		clientAddress: ctx.req.headers.host || 'unknown',
		httpHeaders: ctx.req.headers,
	}
}

Meteor.startup(() => {
	const app = new Koa()
	if (!Meteor.isAppTest) {
		WebApp.connectHandlers.use('/api2', Meteor.bindEnvironment(app.callback()))
	}
	app.use(cors())
	app.use(koaRouter.routes()).use(koaRouter.allowedMethods())
})
