import Koa from 'koa'
import cors from '@koa/cors'
import KoaRouter from '@koa/router'
import { logger } from '../../logging'
import { WebApp } from 'meteor/webapp'
import { check, Match } from '../../../lib/check'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '../../../lib/api/client'
import { getCurrentTime, getRandomString, protectString } from '../../../lib/lib'
import { RestAPI } from '../../../lib/api/rest'
import { RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { MethodContextAPI } from '../../../lib/api/methods'
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
import { interpollateTranslation, translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { Credentials } from '../../security/lib/credentials'

function restAPIUserEvent(
	ctx: Koa.ParameterizedContext<
		Koa.DefaultState,
		Koa.DefaultContext & KoaRouter.RouterParamContext<Koa.DefaultState, Koa.DefaultContext>,
		unknown
	>
): string {
	return `rest_api_${ctx.method}_${ctx.URL.toString()}`
}

class ServerRestAPI implements RestAPI {
	static getMethodContext(connection: Meteor.Connection): MethodContextAPI {
		return { userId: null, connection, isSimulation: false, setUserId: () => {}, unblock: () => {} }
	}

	static getCredentials(_connection: Meteor.Connection): Credentials {
		return { userId: null }
	}

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
			ServerRestAPI.getMethodContext(connection),
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
			ServerRestAPI.getMethodContext(connection),
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
			ServerRestAPI.getMethodContext(connection),
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
				ServerRestAPI.getMethodContext(connection),
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
				ServerRestAPI.getMethodContext(connection),
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
			ServerRestAPI.getMethodContext(connection),
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
			ServerRestAPI.getMethodContext(connection),
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
			ServerRestAPI.getMethodContext(connection),
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
			ServerRestAPI.getMethodContext(connection),
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
			ServerRestAPI.getMethodContext(connection),
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
			ServerRestAPI.getMethodContext(connection),
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
		fromPartInstanceId: PartInstanceId | undefined
	): Promise<ClientAPI.ClientResponse<void>> {
		triggerWriteAccess()
		const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId)
		if (!rundownPlaylist) throw new Error(`Rundown playlist ${rundownPlaylistId} does not exist`)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			ServerRestAPI.getMethodContext(connection),
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
			ServerRestAPI.getMethodContext(connection),
			event,
			getCurrentTime(),
			'switchRouteSet',
			[studioId, routeSetId, state],
			async () => {
				check(studioId, String)
				check(routeSetId, String)
				check(state, Boolean)

				const access = await StudioContentWriteAccess.routeSet(
					ServerRestAPI.getCredentials(connection),
					studioId
				)
				return ServerPlayoutAPI.switchRouteSet(access, routeSetId, state)
			}
		)
	}

	async clearSourceLayer(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		sourceLayerId: string
	): Promise<ClientAPI.ClientResponse<void>> {
		const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId)
		if (!rundownPlaylist) throw new Error(`Rundown playlist ${rundownPlaylistId} does not exist`)
		if (!rundownPlaylist.currentPartInstanceId || !rundownPlaylist.activationId)
			throw new Error(`Rundown playlist ${rundownPlaylistId} is not currently active`)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			ServerRestAPI.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(sourceLayerId, String)
			},
			StudioJobs.StopPiecesOnSourceLayers,
			{
				playlistId: rundownPlaylistId,
				partInstanceId: rundownPlaylist.currentPartInstanceId,
				sourceLayerIds: [sourceLayerId],
			}
		)
	}

	recallStickyPiece(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		sourceLayerId: string
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			ServerRestAPI.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(sourceLayerId, String)
			},
			StudioJobs.StartStickyPieceOnSourceLayer,
			{
				playlistId: rundownPlaylistId,
				sourceLayerId,
			}
		)
	}
}

const koaRouter = new KoaRouter()

async function sofieAPIRequest<Params, Body, Response>(
	method: 'get' | 'post' | 'delete',
	route: string,
	handler: (
		serverAPI: RestAPI,
		connection: Meteor.Connection,
		event: string,
		params: Params,
		body: Body
	) => Promise<ClientAPI.ClientResponse<Response>>
) {
	koaRouter[method](route, async (ctx, next) => {
		try {
			let serverAPI = new ServerRestAPI()
			let response = await handler(
				serverAPI,
				makeConnection(ctx),
				restAPIUserEvent(ctx),
				ctx.params as Params,
				ctx.req.body as Body
			)
			if (ClientAPI.isClientResponseError(response)) throw response.error
			ctx.body = response
			ctx.status = 200
		} catch (e) {
			const errMsg = UserError.isUserError(e)
				? translateMessage(e.message, interpollateTranslation)
				: (e as Error).message
			logger.error('POST activate failed - ' + errMsg)
			ctx.type = 'application/json'
			ctx.body = JSON.stringify({ message: errMsg })
			ctx.status = 412
		}
		await next()
	})
}

koaRouter.get('/', async (ctx, next) => {
	ctx.type = 'application/json'
	let server = new ServerRestAPI()
	ctx.body = ClientAPI.responseSuccess(await server.index())
	ctx.status = 200
	await next()
})

sofieAPIRequest<{ playlistId: string }, { rehearsal: boolean }, void>(
	'post',
	'/playlists/:playlistId/activate',
	async (serverAPI, connection, event, params, body) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		const rehearsal = body.rehearsal
		logger.info(`koa POST: activate ${rundownPlaylistId} - ${rehearsal ? 'rehearsal' : 'live'}`)

		check(rundownPlaylistId, String)
		return await serverAPI.activate(connection, event, rundownPlaylistId, rehearsal)
	}
)

sofieAPIRequest<{ playlistId: string }, never, void>(
	'post',
	'/playlists/:playlistId/deactivate',
	async (serverAPI, connection, event, params, _) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		logger.info(`koa POST: deactivate ${rundownPlaylistId}`)

		check(rundownPlaylistId, String)
		return await serverAPI.deactivate(connection, event, rundownPlaylistId)
	}
)

sofieAPIRequest<{ playlistId: string }, { adLibId: string; actionType?: string }, object>(
	'post',
	'/playlists/:playlistId/executeAdLib',
	async (serverAPI, connection, event, params, body) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		const adLibId = protectString<AdLibActionId | RundownBaselineAdLibActionId | PieceId | BucketAdLibId>(
			body.adLibId
		)
		const actionTypeObj = body
		const triggerMode = actionTypeObj ? (actionTypeObj as { actionType: string }).actionType : undefined
		logger.info(`koa POST: executeAdLib ${rundownPlaylistId} ${adLibId} - triggerMode: ${triggerMode}`)

		check(adLibId, String)
		check(rundownPlaylistId, String)

		return await serverAPI.executeAdLib(connection, event, rundownPlaylistId, adLibId, triggerMode)
	}
)

sofieAPIRequest<{ playlistId: string }, { delta: number }, PartId | null>(
	'post',
	'/playlists/:playlistId/moveNextPart',
	async (serverAPI, connection, event, params, body) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		const delta = body.delta
		logger.info(`koa POST: moveNextPart ${rundownPlaylistId} ${delta}`)

		check(rundownPlaylistId, String)
		check(delta, Number)
		return await serverAPI.moveNextPart(connection, event, rundownPlaylistId, delta)
	}
)

sofieAPIRequest<{ playlistId: string }, { delta: number }, PartId | null>(
	'post',
	'/playlists/:playlistId/moveNextSegment',
	async (serverAPI, connection, event, params, body) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		const delta = body.delta
		logger.info(`koa POST: moveNextSegment ${rundownPlaylistId} ${delta}`)

		check(rundownPlaylistId, String)
		check(delta, Number)
		return await serverAPI.moveNextSegment(connection, event, rundownPlaylistId, delta)
	}
)

sofieAPIRequest<{ playlistId: string }, never, object>(
	'post',
	'/playlists/:playlistId/reloadPlaylist',
	async (serverAPI, connection, event, params, _) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		logger.info(`koa POST: reloadPlaylist ${rundownPlaylistId}`)

		check(rundownPlaylistId, String)
		return await serverAPI.reloadPlaylist(connection, event, rundownPlaylistId)
	}
)

sofieAPIRequest<{ playlistId: string }, never, void>(
	'post',
	'/playlists/:playlistId/resetPlaylist',
	async (serverAPI, connection, event, params, _) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		logger.info(`koa POST: resetPlaylist ${rundownPlaylistId}`)

		check(rundownPlaylistId, String)
		return await serverAPI.resetPlaylist(connection, event, rundownPlaylistId)
	}
)

sofieAPIRequest<{ playlistId: string }, { partId: string }, void>(
	'post',
	'/playlists/:playlistId/setNextPart',
	async (serverAPI, connection, event, params, body) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		const partId = protectString<PartId>(body.partId)
		logger.info(`koa POST: setNextPart ${rundownPlaylistId} ${partId}`)

		check(rundownPlaylistId, String)
		check(partId, String)
		return await serverAPI.setNextPart(connection, event, rundownPlaylistId, partId)
	}
)

sofieAPIRequest<{ playlistId: string }, { segmentId: string }, void>(
	'post',
	'/playlists/:playlistId/setNextSegment',
	async (serverAPI, connection, event, params, body) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		const segmentId = protectString<SegmentId>(body.segmentId)
		logger.info(`koa POST: setNextSegment ${rundownPlaylistId} ${segmentId}`)

		check(rundownPlaylistId, String)
		check(segmentId, String)
		return await serverAPI.setNextSegment(connection, event, rundownPlaylistId, segmentId)
	}
)

sofieAPIRequest<{ playlistId: string }, { fromPartInstanceId?: string }, void>(
	'post',
	'/playlists/:playlistId/take',
	async (serverAPI, connection, event, params, body) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		const fromPartInstanceId = body.fromPartInstanceId
		logger.info(`koa POST: take ${rundownPlaylistId}`)

		check(rundownPlaylistId, String)
		check(fromPartInstanceId, Match.Optional(String))
		return await serverAPI.take(connection, event, rundownPlaylistId, protectString(fromPartInstanceId))
	}
)

sofieAPIRequest<{ studioId: string }, { routeSetId: string; active: boolean }, void>(
	'post',
	'/studios/:studioId/switchRouteSet',
	async (serverAPI, connection, event, params, body) => {
		const studioId = protectString<StudioId>(params.studioId)
		const routeSetId = body.routeSetId
		const active = body.active
		logger.info(`koa POST: switchRouteSet ${studioId} ${routeSetId} ${active}`)

		check(studioId, String)
		check(routeSetId, String)
		check(active, Boolean)
		return await serverAPI.switchRouteSet(connection, event, studioId, routeSetId, active)
	}
)

sofieAPIRequest<{ playlistId: string; sourceLayerId: string }, never, void>(
	'delete',
	'/playlists/{playlistId}/sourceLayer/{sourceLayerId}',
	async (serverAPI, connection, event, params, _) => {
		const playlistId = protectString<RundownPlaylistId>(params.playlistId)
		const sourceLayerId = params.sourceLayerId
		logger.info(`koa DELETE: sourceLayer ${playlistId} ${sourceLayerId}`)

		check(playlistId, String)
		check(sourceLayerId, String)
		return await serverAPI.clearSourceLayer(connection, event, playlistId, sourceLayerId)
	}
)

sofieAPIRequest<{ playlistId: string; sourceLayerId: string }, never, void>(
	'post',
	'/playlists/{playlistId}/sourceLayer/{sourceLayerId}/recallSticky',
	async (serverAPI, connection, event, params, _) => {
		const playlistId = protectString<RundownPlaylistId>(params.playlistId)
		const sourceLayerId = params.sourceLayerId
		logger.info(`koa POST: sourceLayer recallSticky ${playlistId} ${sourceLayerId}`)

		check(playlistId, String)
		check(sourceLayerId, String)
		return await serverAPI.recallStickyPiece(connection, event, playlistId, sourceLayerId)
	}
)

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
