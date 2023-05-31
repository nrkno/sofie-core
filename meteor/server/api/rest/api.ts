import Koa from 'koa'
import cors from '@koa/cors'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { logger } from '../../logging'
import { WebApp } from 'meteor/webapp'
import { check, Match } from '../../../lib/check'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '../../../lib/api/client'
import { getCurrentTime, getRandomString, protectString, unprotectString } from '../../../lib/lib'
import {
	APIPeripheralDevice,
	PeripheralDeviceActionRestart,
	PeripheralDeviceActionType,
	APIBlueprint,
	RestAPI,
	APIShowStyleBase,
	APIShowStyleVariant,
	APIStudio,
	ShowStyleBaseAction,
	StudioAction,
	StudioActionType,
	ShowStyleBaseActionType,
	MigrationData,
	PendingMigrations,
	PeripheralDeviceAction,
} from '../../../lib/api/rest'
import { MeteorCall, MethodContextAPI } from '../../../lib/api/methods'
import { ServerClientAPI } from '../client'
import { ServerRundownAPI } from '../rundown'
import { triggerWriteAccess } from '../../security/lib/securityVerify'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { CURRENT_SYSTEM_VERSION } from '../../migration/currentSystemVersion'
import {
	AdLibActionId,
	BlueprintId,
	BucketAdLibId,
	PartId,
	PartInstanceId,
	PeripheralDeviceId,
	PieceId,
	RundownBaselineAdLibActionId,
	RundownPlaylistId,
	SegmentId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { StudioContentWriteAccess } from '../../security/studio'
import { ServerPlayoutAPI } from '../playout/playout'
import { TriggerReloadDataResponse } from '../../../lib/api/userActions'
import { interpollateTranslation, translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { Credentials } from '../../security/lib/credentials'
import { assertNever } from '@sofie-automation/shared-lib/dist/lib/lib'
import {
	AdLibActions,
	AdLibPieces,
	Blueprints,
	BucketAdLibs,
	PeripheralDevices,
	RundownBaselineAdLibActions,
	RundownBaselineAdLibPieces,
	RundownPlaylists,
	Rundowns,
	ShowStyleBases,
	ShowStyleVariants,
	Studios,
} from '../../collections'
import {
	APIBlueprintFrom,
	APIPeripheralDeviceFrom,
	APIShowStyleBaseFrom,
	APIShowStyleVariantFrom,
	APIStudioFrom,
	showStyleBaseFrom,
	showStyleVariantFrom,
	studioFrom,
} from './typeConversion'
import {
	runUpgradeForShowStyleBase,
	runUpgradeForStudio,
	validateConfigForShowStyleBase,
	validateConfigForStudio,
} from '../../migration/upgrades'
import { MigrationStepInputResult, NoteSeverity } from '@sofie-automation/blueprints-integration'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { ShowStyleVariant } from '../../../lib/collections/ShowStyleVariants'
import { Studio } from '../../../lib/collections/Studios'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { executePeripheralDeviceFunction } from '../peripheralDevice/executeFunction'

function restAPIUserEvent(
	ctx: Koa.ParameterizedContext<
		Koa.DefaultState,
		Koa.DefaultContext & KoaRouter.RouterParamContext<Koa.DefaultState, Koa.DefaultContext>,
		unknown
	>
): string {
	return `rest_api_${ctx.method}_${ctx.URL.origin}/api/v1.0${ctx.URL.pathname}}`
}

class ServerRestAPI implements RestAPI {
	static getMethodContext(connection: Meteor.Connection): MethodContextAPI {
		return {
			userId: null,
			connection,
			isSimulation: false,
			setUserId: () => {
				/* no-op */
			},
			unblock: () => {
				/* no-op */
			},
		}
	}

	static getCredentials(_connection: Meteor.Connection): Credentials {
		return { userId: null }
	}

	async index(): Promise<ClientAPI.ClientResponse<{ version: string }>> {
		triggerWriteAccess()

		return ClientAPI.responseSuccess({ version: CURRENT_SYSTEM_VERSION })
	}

	async getAllRundownPlaylists(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>> {
		const rundownPlaylists = (await RundownPlaylists.findFetchAsync({}, { projection: { _id: 1 } })) as Array<
			Pick<RundownPlaylist, '_id'>
		>
		return ClientAPI.responseSuccess(
			rundownPlaylists.map((rundownPlaylist) => ({ id: unprotectString(rundownPlaylist._id) }))
		)
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
			const rundownPlaylist = await RundownPlaylists.findOneAsync(rundownPlaylistId, {
				projection: { currentPartInfo: 1 },
			})
			if (!rundownPlaylist)
				return ClientAPI.responseError(
					UserError.from(
						new Error(`Rundown playlist does not exist`),
						UserErrorMessage.RundownPlaylistNotFound
					),
					404
				)
			if (rundownPlaylist.currentPartInfo === null)
				return ClientAPI.responseError(
					UserError.from(Error(`No active Part in ${rundownPlaylistId}`), UserErrorMessage.PartNotFound),
					412
				)

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
					partInstanceId: rundownPlaylist.currentPartInfo.partInstanceId,
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
				UserError.from(new Error(`No adLib with Id ${adLibId}`), UserErrorMessage.AdlibNotFound),
				412
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
		const rundownPlaylist = await RundownPlaylists.findOneAsync(rundownPlaylistId)
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
				fromPartInstanceId: fromPartInstanceId ?? rundownPlaylist.currentPartInfo?.partInstanceId ?? null,
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
		const rundownPlaylist = await RundownPlaylists.findOneAsync(rundownPlaylistId)
		if (!rundownPlaylist)
			return ClientAPI.responseError(
				UserError.from(
					Error(`Rundown playlist ${rundownPlaylistId} does not exist`),
					UserErrorMessage.RundownPlaylistNotFound
				),
				412
			)
		if (!rundownPlaylist.currentPartInfo?.partInstanceId || !rundownPlaylist.activationId)
			return ClientAPI.responseError(
				UserError.from(
					new Error(`Rundown playlist ${rundownPlaylistId} is not currently active`),
					UserErrorMessage.InactiveRundown
				),
				412
			)

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
				partInstanceId: rundownPlaylist.currentPartInfo.partInstanceId,
				sourceLayerIds: [sourceLayerId],
			}
		)
	}

	async recallStickyPiece(
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

	async getPeripheralDevices(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>> {
		const peripheralDevices = (await PeripheralDevices.findFetchAsync({}, { projection: { _id: 1 } })) as Array<
			Pick<PeripheralDevice, '_id'>
		>
		return ClientAPI.responseSuccess(peripheralDevices.map((p) => ({ id: unprotectString(p._id) })))
	}

	async getPeripheralDevice(
		_connection: Meteor.Connection,
		_event: string,
		deviceId: PeripheralDeviceId
	): Promise<ClientAPI.ClientResponse<APIPeripheralDevice>> {
		const device = await PeripheralDevices.findOneAsync(deviceId)
		if (!device)
			return ClientAPI.responseError(
				UserError.from(
					new Error(`Device ${deviceId} does not exist`),
					UserErrorMessage.PeripheralDeviceNotFound
				),
				404
			)
		return ClientAPI.responseSuccess(APIPeripheralDeviceFrom(device))
	}

	async peripheralDeviceAction(
		_connection: Meteor.Connection,
		_event: string,
		deviceId: PeripheralDeviceId,
		action: PeripheralDeviceActionRestart
	): Promise<ClientAPI.ClientResponse<void>> {
		const device = await PeripheralDevices.findOneAsync(deviceId)
		if (!device)
			return ClientAPI.responseError(
				UserError.from(
					new Error(`Device ${deviceId} does not exist`),
					UserErrorMessage.PeripheralDeviceNotFound
				),
				404
			)

		switch (action.type) {
			case PeripheralDeviceActionType.RESTART:
				// This dispatches the command but does not wait for it to complete
				await executePeripheralDeviceFunction(deviceId, 'killProcess', 1).catch(logger.error)
				break
			default:
				assertNever(action.type)
		}

		return ClientAPI.responseSuccess(undefined, 202)
	}

	async getPeripheralDevicesForStudio(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>> {
		const peripheralDevices = (await PeripheralDevices.findFetchAsync(
			{ studioId },
			{ projection: { _id: 1 } }
		)) as Array<Pick<PeripheralDevice, '_id'>>

		return ClientAPI.responseSuccess(peripheralDevices.map((p) => ({ id: unprotectString(p._id) })))
	}

	async getAllBlueprints(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>> {
		const blueprints = (await Blueprints.findFetchAsync({}, { projection: { _id: 1 } })) as Array<
			Pick<Blueprint, '_id'>
		>

		return ClientAPI.responseSuccess(blueprints.map((blueprint) => ({ id: unprotectString(blueprint._id) })))
	}

	async getBlueprint(
		_connection: Meteor.Connection,
		_event: string,
		blueprintId: BlueprintId
	): Promise<ClientAPI.ClientResponse<APIBlueprint>> {
		const blueprint = await Blueprints.findOneAsync(blueprintId)
		if (!blueprint) {
			return ClientAPI.responseError(
				UserError.from(new Error(`Blueprint ${blueprintId} not found`), UserErrorMessage.BlueprintNotFound),
				404
			)
		}

		const apiBlueprint = APIBlueprintFrom(blueprint)
		if (!apiBlueprint) throw new Error(`Blueprint could not be converted to API representation`)
		return ClientAPI.responseSuccess(apiBlueprint)
	}

	async assignSystemBlueprint(
		_connection: Meteor.Connection,
		_event: string,
		blueprintId: BlueprintId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ClientAPI.responseSuccess(await MeteorCall.blueprint.assignSystemBlueprint(blueprintId))
	}

	async unassignSystemBlueprint(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<void>> {
		return ClientAPI.responseSuccess(await MeteorCall.blueprint.assignSystemBlueprint(undefined))
	}

	async attachDeviceToStudio(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		deviceId: PeripheralDeviceId
	): Promise<ClientAPI.ClientResponse<void>> {
		const studio = await Studios.findOneAsync(studioId)
		if (!studio)
			return ClientAPI.responseError(
				UserError.from(new Error(`Studio does not exist`), UserErrorMessage.StudioNotFound),
				404
			)

		const device = await PeripheralDevices.findOneAsync(deviceId)
		if (!device)
			return ClientAPI.responseError(
				UserError.from(new Error(`Studio does not exist`), UserErrorMessage.PeripheralDeviceNotFound),
				404
			)

		if (device.studioId !== undefined && device.studioId !== studio._id) {
			return ClientAPI.responseError(
				UserError.from(
					new Error(`Device already attached to studio`),
					UserErrorMessage.DeviceAlreadyAttachedToStudio
				),
				412
			)
		}
		await PeripheralDevices.updateAsync(deviceId, {
			$set: {
				studioId,
			},
		})

		return ClientAPI.responseSuccess(undefined, 200)
	}

	async detachDeviceFromStudio(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		deviceId: PeripheralDeviceId
	) {
		const studio = await Studios.findOneAsync(studioId)
		if (!studio)
			return ClientAPI.responseError(
				UserError.from(new Error(`Studio does not exist`), UserErrorMessage.StudioNotFound),
				404
			)
		await PeripheralDevices.updateAsync(deviceId, {
			$unset: {
				studioId: 1,
			},
		})

		return ClientAPI.responseSuccess(undefined, 200)
	}

	async getShowStyleBases(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>> {
		const showStyleBases = (await ShowStyleBases.findFetchAsync({}, { projection: { _id: 1 } })) as Array<
			Pick<ShowStyleBase, '_id'>
		>
		return ClientAPI.responseSuccess(showStyleBases.map((base) => ({ id: unprotectString(base._id) })))
	}

	async addShowStyleBase(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBase: APIShowStyleBase
	): Promise<ClientAPI.ClientResponse<string>> {
		const showStyle = await showStyleBaseFrom(showStyleBase)
		if (!showStyle) throw new Meteor.Error(400, `Invalid ShowStyleBase`)
		const showStyleId = showStyle._id
		await ShowStyleBases.insertAsync(showStyle)

		return ClientAPI.responseSuccess(unprotectString(showStyleId), 200)
	}

	async getShowStyleBase(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId
	): Promise<ClientAPI.ClientResponse<APIShowStyleBase>> {
		const showStyleBase = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase ${showStyleBaseId} does not exist`)

		return ClientAPI.responseSuccess(APIShowStyleBaseFrom(showStyleBase))
	}

	async addOrUpdateShowStyleBase(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId,
		showStyleBase: APIShowStyleBase
	): Promise<ClientAPI.ClientResponse<void>> {
		const showStyle = await showStyleBaseFrom(showStyleBase, showStyleBaseId)
		if (!showStyle) throw new Meteor.Error(400, `Invalid ShowStyleBase`)

		const existingShowStyle = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (existingShowStyle) {
			const rundowns = (await Rundowns.findFetchAsync(
				{ showStyleBaseId },
				{ projection: { playlistId: 1 } }
			)) as Array<Pick<Rundown, 'playlistId'>>
			const playlists = (await RundownPlaylists.findFetchAsync(
				{ _id: { $in: rundowns.map((r) => r.playlistId) } },
				{
					projection: {
						activationId: 1,
					},
				}
			)) as Array<Pick<RundownPlaylist, 'activationId'>>
			if (playlists.some((playlist) => playlist.activationId !== undefined)) {
				throw new Meteor.Error(
					412,
					`Cannot update ShowStyleBase ${showStyleBaseId} as it is in use by an active Playlist`
				)
			}
		}

		await ShowStyleBases.upsertAsync(showStyleBaseId, showStyle)

		const validation = await validateConfigForShowStyleBase(showStyleBaseId)
		const validateOK = validation.messages.reduce((acc, msg) => acc && msg.level === NoteSeverity.INFO, true)
		if (!validateOK) {
			logger.error(
				`addOrUpdateShowStyleBase failed validation with errors: ${JSON.stringify(validation.messages)}`
			)
			throw new Meteor.Error(409, `ShowStyleBase ${showStyleBaseId} has failed validation`)
		}

		return ClientAPI.responseSuccess(await runUpgradeForShowStyleBase(showStyleBaseId))
	}

	async deleteShowStyleBase(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId
	): Promise<ClientAPI.ClientResponse<void>> {
		const rundowns = (await Rundowns.findFetchAsync(
			{ showStyleBaseId },
			{ projection: { playlistId: 1 } }
		)) as Array<Pick<Rundown, 'playlistId'>>
		const playlists = (await RundownPlaylists.findFetchAsync(
			{ _id: { $in: rundowns.map((r) => r.playlistId) } },
			{
				projection: {
					activationId: 1,
				},
			}
		)) as Array<Pick<RundownPlaylist, 'activationId'>>
		if (playlists.some((playlist) => playlist.activationId !== undefined)) {
			throw new Meteor.Error(
				412,
				`Cannot delete ShowStyleBase ${showStyleBaseId} as it is in use by an active Playlist`
			)
		}

		await ShowStyleBases.removeAsync(showStyleBaseId)
		return ClientAPI.responseSuccess(undefined)
	}

	async getShowStyleVariants(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>> {
		const showStyleBase = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase ${showStyleBaseId} not found`)

		const showStyleVariants = (await ShowStyleVariants.findFetchAsync(
			{ showStyleBaseId },
			{ projection: { _id: 1 } }
		)) as Array<Pick<ShowStyleVariant, '_id'>>

		return ClientAPI.responseSuccess(showStyleVariants.map((variant) => ({ id: unprotectString(variant._id) })))
	}

	async addShowStyleVariant(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId,
		showStyleVariant: APIShowStyleVariant
	): Promise<ClientAPI.ClientResponse<string>> {
		const showStyleBase = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase ${showStyleBaseId} not found`)

		const variant = showStyleVariantFrom(showStyleVariant)
		if (!variant) throw new Meteor.Error(400, `Invalid ShowStyleVariant`)

		const variantId = variant._id
		await ShowStyleVariants.insertAsync(variant)

		return ClientAPI.responseSuccess(unprotectString(variantId), 200)
	}

	async getShowStyleVariant(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId,
		showStyleVariantId: ShowStyleVariantId
	): Promise<ClientAPI.ClientResponse<APIShowStyleVariant>> {
		const showStyleBase = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase ${showStyleBaseId} not found`)

		const variant = await ShowStyleVariants.findOneAsync(showStyleVariantId)
		if (!variant) throw new Meteor.Error(404, `ShowStyleVariant ${showStyleVariantId} not found`)

		return ClientAPI.responseSuccess(APIShowStyleVariantFrom(variant))
	}

	async addOrUpdateShowStyleVariant(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId,
		showStyleVariantId: ShowStyleVariantId,
		showStyleVariant: APIShowStyleVariant
	): Promise<ClientAPI.ClientResponse<void>> {
		const showStyleBase = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase ${showStyleBaseId} does not exist`)

		const showStyle = showStyleVariantFrom(showStyleVariant, showStyleVariantId)
		if (!showStyle) throw new Meteor.Error(400, `Invalid ShowStyleVariant`)

		const existingShowStyle = await ShowStyleVariants.findOneAsync(showStyleVariantId)
		if (existingShowStyle) {
			const rundowns = (await Rundowns.findFetchAsync(
				{ showStyleVariantId },
				{ projection: { playlistId: 1 } }
			)) as Array<Pick<Rundown, 'playlistId'>>
			const playlists = (await RundownPlaylists.findFetchAsync(
				{ _id: { $in: rundowns.map((r) => r.playlistId) } },
				{
					projection: {
						activationId: 1,
					},
				}
			)) as Array<Pick<RundownPlaylist, 'activationId'>>
			if (playlists.some((playlist) => playlist.activationId !== undefined)) {
				throw new Meteor.Error(
					412,
					`Cannot update ShowStyleVariant ${showStyleVariantId} as it is in use by an active Playlist`
				)
			}
		}

		await ShowStyleVariants.upsertAsync(showStyleVariantId, showStyle)
		return ClientAPI.responseSuccess(undefined, 200)
	}

	async deleteShowStyleVariant(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId,
		showStyleVariantId: ShowStyleVariantId
	): Promise<ClientAPI.ClientResponse<void>> {
		const showStyleBase = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase ${showStyleBaseId} does not exist`)

		const rundowns = (await Rundowns.findFetchAsync(
			{ showStyleVariantId },
			{ projection: { playlistId: 1 } }
		)) as Array<Pick<Rundown, 'playlistId'>>
		const playlists = (await RundownPlaylists.findFetchAsync(
			{ _id: { $in: rundowns.map((r) => r.playlistId) } },
			{
				projection: {
					activationId: 1,
				},
			}
		)) as Array<Pick<RundownPlaylist, 'activationId'>>
		if (playlists.some((playlist) => playlist.activationId !== undefined)) {
			throw new Meteor.Error(
				412,
				`Cannot delete ShowStyleVariant ${showStyleVariantId} as it is in use by an active Playlist`
			)
		}

		await ShowStyleVariants.removeAsync(showStyleVariantId)
		return ClientAPI.responseSuccess(undefined, 200)
	}

	async getStudios(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>> {
		const studios = (await Studios.findFetchAsync({}, { projection: { _id: 1 } })) as Array<Pick<Studio, '_id'>>

		return ClientAPI.responseSuccess(studios.map((studio) => ({ id: unprotectString(studio._id) })))
	}

	async addStudio(
		_connection: Meteor.Connection,
		_event: string,
		studio: APIStudio
	): Promise<ClientAPI.ClientResponse<string>> {
		const newStudio = await studioFrom(studio)
		if (!newStudio) throw new Meteor.Error(400, `Invalid Studio`)

		const newStudioId = newStudio._id
		await Studios.insertAsync(newStudio)

		return ClientAPI.responseSuccess(unprotectString(newStudioId), 200)
	}

	async getStudio(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId
	): Promise<ClientAPI.ClientResponse<APIStudio>> {
		const studio = await Studios.findOneAsync(studioId)
		if (!studio) throw new Meteor.Error(404, `Studio ${studioId} not found`)

		return ClientAPI.responseSuccess(APIStudioFrom(studio))
	}

	async addOrUpdateStudio(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		studio: APIStudio
	): Promise<ClientAPI.ClientResponse<void>> {
		const newStudio = await studioFrom(studio, studioId)
		if (!newStudio) throw new Meteor.Error(400, `Invalid Studio`)

		const existingStudio = await Studios.findOneAsync(studioId)
		if (existingStudio) {
			const playlists = (await RundownPlaylists.findFetchAsync(
				{ studioId },
				{
					projection: {
						activationId: 1,
					},
				}
			)) as Array<Pick<RundownPlaylist, 'activationId'>>
			if (playlists.some((p) => p.activationId !== undefined)) {
				throw new Meteor.Error(412, `Studio ${studioId} cannot be updated, it is in use in an active Playlist`)
			}
		}

		await Studios.upsertAsync(studioId, newStudio)

		const validation = await validateConfigForStudio(studioId)
		const validateOK = validation.messages.reduce((acc, msg) => acc && msg.level === NoteSeverity.INFO, true)
		if (!validateOK) {
			logger.error(`addOrUpdateStudio failed validation with errors: ${JSON.stringify(validation.messages)}`)
			throw new Meteor.Error(409, `Studio ${studioId} has failed validation`)
		}

		return ClientAPI.responseSuccess(await runUpgradeForStudio(studioId))
	}

	async deleteStudio(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId
	): Promise<ClientAPI.ClientResponse<void>> {
		const existingStudio = await Studios.findOneAsync(studioId)
		if (existingStudio) {
			const playlists = (await RundownPlaylists.findFetchAsync(
				{ studioId },
				{
					projection: {
						activationId: 1,
					},
				}
			)) as Array<Pick<RundownPlaylist, 'activationId'>>
			if (playlists.some((p) => p.activationId !== undefined)) {
				throw new Meteor.Error(412, `Studio ${studioId} cannot be deleted, it is in use in an active Playlist`)
			}
		}

		await PeripheralDevices.updateAsync({ studioId }, { $unset: { studioId: 1 } })

		const rundownPlaylists = (await RundownPlaylists.findFetchAsync(
			{ studioId },
			{
				projection: {
					_id: 1,
				},
			}
		)) as Array<Pick<RundownPlaylist, '_id'>>

		const promises = rundownPlaylists.map(async (rundownPlaylist) =>
			ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
				ServerRestAPI.getMethodContext(connection),
				event,
				getCurrentTime(),
				rundownPlaylist._id,
				() => {
					check(rundownPlaylist._id, String)
				},
				StudioJobs.RemovePlaylist,
				{
					playlistId: rundownPlaylist._id,
				}
			)
		)

		await Promise.all(promises)
		await Studios.removeAsync(studioId)

		return ClientAPI.responseSuccess(undefined, 200)
	}

	async studioAction(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		action: StudioAction
	): Promise<ClientAPI.ClientResponse<void>> {
		switch (action.type) {
			case StudioActionType.BLUEPRINT_UPGRADE:
				return ClientAPI.responseSuccess(await runUpgradeForStudio(studioId))
			default:
				assertNever(action.type)
				throw new Meteor.Error(400, `Invalid action type`)
		}
	}

	async showStyleBaseAction(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId,
		action: ShowStyleBaseAction
	): Promise<ClientAPI.ClientResponse<void>> {
		switch (action.type) {
			case ShowStyleBaseActionType.BLUEPRINT_UPGRADE:
				return ClientAPI.responseSuccess(await runUpgradeForShowStyleBase(showStyleBaseId))
			default:
				assertNever(action.type)
				throw new Meteor.Error(400, `Invalid action type`)
		}
	}

	async getPendingMigrations(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<{ inputs: PendingMigrations }>> {
		const migrationStatus = await MeteorCall.migration.getMigrationStatus()
		if (!migrationStatus.migrationNeeded) return ClientAPI.responseSuccess({ inputs: [] })

		const requiredInputs: PendingMigrations = []
		for (const migration of migrationStatus.migration.manualInputs) {
			if (migration.stepId && migration.attribute) {
				requiredInputs.push({
					stepId: migration.stepId,
					attributeId: migration.attribute,
				})
			}
		}

		return ClientAPI.responseSuccess({ inputs: requiredInputs })
	}

	async applyPendingMigrations(
		_connection: Meteor.Connection,
		_event: string,
		inputs: MigrationData
	): Promise<ClientAPI.ClientResponse<void>> {
		const migrationStatus = await MeteorCall.migration.getMigrationStatus()
		if (!migrationStatus.migrationNeeded) throw new Error(`Migration does not need to be applied`)

		const migrationData: MigrationStepInputResult[] = inputs.map((input) => ({
			stepId: input.stepId,
			attribute: input.attributeId,
			value: input.migrationValue,
		}))
		const result = await MeteorCall.migration.runMigration(
			migrationStatus.migration.chunks,
			migrationStatus.migration.hash,
			migrationData
		)
		if (result.migrationCompleted) return ClientAPI.responseSuccess(undefined)
		throw new Error(`Unknown error occurred`)
	}
}

const koaRouter = new KoaRouter()

function extractErrorCode(e: unknown): number {
	if (ClientAPI.isClientResponseError(e)) {
		return e.errorCode
	} else if (UserError.isUserError(e)) {
		return e.errorCode
	} else if ((e as Meteor.Error).error && typeof (e as Meteor.Error).error === 'number') {
		return (e as Meteor.Error).error as number
	} else {
		return 500
	}
}

function extractErrorMessage(e: unknown): string {
	if (ClientAPI.isClientResponseError(e)) {
		return translateMessage(e.error.message, interpollateTranslation)
	} else if (UserError.isUserError(e)) {
		return translateMessage(e.message, interpollateTranslation)
	} else if ((e as Meteor.Error).reason && typeof (e as Meteor.Error).reason === 'string') {
		return (e as Meteor.Error).reason as string
	} else {
		return (e as Error).message ?? 'Internal Server Error' // Fallback in case e is not an error type
	}
}

function sofieAPIRequest<Params, Body, Response>(
	method: 'get' | 'post' | 'put' | 'delete',
	route: string,
	errMsgs: Map<number, UserErrorMessage>,
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
			const serverAPI = new ServerRestAPI()
			const response = await handler(
				serverAPI,
				makeConnection(ctx),
				restAPIUserEvent(ctx),
				ctx.params as unknown as Params,
				ctx.request.body as unknown as Body
			)
			if (ClientAPI.isClientResponseError(response)) throw response
			ctx.body = JSON.stringify({ status: response.success, result: response.result })
			ctx.status = response.success
		} catch (e) {
			const errCode = extractErrorCode(e)
			const errMsg = extractErrorMessage(
				UserError.create(errMsgs.get(errCode) || UserErrorMessage.InternalError, undefined, errCode)
			)

			logger.error(`${method.toUpperCase()} failed for route ${route}: ${errCode} - ${errMsg}`)
			ctx.type = 'application/json'
			ctx.body = JSON.stringify({ status: errCode, message: errMsg })
			ctx.status = errCode
		}
		await next()
	})
}

/* ****************************************************************************
  IMPORTANT: IF YOU MAKE ANY MODIFICATIONS TO THE API, YOU MUST ENSURE THAT
  THEY ARE REFLECTED IN THE OPENAPI SPECIFICATION FILES
  (/packages/openapi/api/definitions)
**************************************************************************** */

koaRouter.get('/', async (ctx, next) => {
	ctx.type = 'application/json'
	const server = new ServerRestAPI()
	const response = ClientAPI.responseSuccess(await server.index())
	ctx.body = JSON.stringify({ status: response.success, result: response.result })
	ctx.status = response.success
	await next()
})

sofieAPIRequest<never, never, Array<{ id: string }>>(
	'get',
	'/playlists',
	new Map(),
	async (serverAPI, connection, event, _params, _body) => {
		logger.info(`API GET: playlists`)
		return await serverAPI.getAllRundownPlaylists(connection, event)
	}
)

sofieAPIRequest<{ playlistId: string }, { rehearsal: boolean }, void>(
	'put',
	'/playlists/:playlistId/activate',
	new Map([
		[404, UserErrorMessage.RundownPlaylistNotFound],
		[412, UserErrorMessage.RundownAlreadyActive],
	]),
	async (serverAPI, connection, event, params, body) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		const rehearsal = body.rehearsal
		logger.info(`API PUT: activate ${rundownPlaylistId} - ${rehearsal ? 'rehearsal' : 'live'}`)

		check(rundownPlaylistId, String)
		return await serverAPI.activate(connection, event, rundownPlaylistId, rehearsal)
	}
)

sofieAPIRequest<{ playlistId: string }, never, void>(
	'put',
	'/playlists/:playlistId/deactivate',
	new Map([[404, UserErrorMessage.RundownPlaylistNotFound]]),
	async (serverAPI, connection, event, params, _) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		logger.info(`API PUT: deactivate ${rundownPlaylistId}`)

		check(rundownPlaylistId, String)
		return await serverAPI.deactivate(connection, event, rundownPlaylistId)
	}
)

sofieAPIRequest<{ playlistId: string }, { adLibId: string; actionType?: string }, object>(
	'post',
	'/playlists/:playlistId/execute-adlib',
	new Map([
		[404, UserErrorMessage.RundownPlaylistNotFound],
		[412, UserErrorMessage.AdlibNotFound],
	]),
	async (serverAPI, connection, event, params, body) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		const adLibId = protectString<AdLibActionId | RundownBaselineAdLibActionId | PieceId | BucketAdLibId>(
			body.adLibId
		)
		const actionTypeObj = body
		const triggerMode = actionTypeObj ? (actionTypeObj as { actionType: string }).actionType : undefined
		logger.info(`API POST: execute-adlib ${rundownPlaylistId} ${adLibId} - triggerMode: ${triggerMode}`)

		check(adLibId, String)
		check(rundownPlaylistId, String)

		return await serverAPI.executeAdLib(connection, event, rundownPlaylistId, adLibId, triggerMode)
	}
)

sofieAPIRequest<{ playlistId: string }, { delta: number }, PartId | null>(
	'post',
	'/playlists/:playlistId/move-next-part',
	new Map([
		[404, UserErrorMessage.RundownPlaylistNotFound],
		[412, UserErrorMessage.PartNotFound],
	]),
	async (serverAPI, connection, event, params, body) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		const delta = body.delta
		logger.info(`API POST: move-next-part ${rundownPlaylistId} ${delta}`)

		check(rundownPlaylistId, String)
		check(delta, Number)
		return await serverAPI.moveNextPart(connection, event, rundownPlaylistId, delta)
	}
)

sofieAPIRequest<{ playlistId: string }, { delta: number }, PartId | null>(
	'post',
	'/playlists/:playlistId/move-next-segment',
	new Map([
		[404, UserErrorMessage.RundownPlaylistNotFound],
		[412, UserErrorMessage.PartNotFound],
	]),
	async (serverAPI, connection, event, params, body) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		const delta = body.delta
		logger.info(`API POST: move-next-segment ${rundownPlaylistId} ${delta}`)

		check(rundownPlaylistId, String)
		check(delta, Number)
		return await serverAPI.moveNextSegment(connection, event, rundownPlaylistId, delta)
	}
)

sofieAPIRequest<{ playlistId: string }, never, object>(
	'put',
	'/playlists/:playlistId/reload-playlist',
	new Map([[404, UserErrorMessage.RundownPlaylistNotFound]]),
	async (serverAPI, connection, event, params, _) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		logger.info(`API PUT: reload-playlist ${rundownPlaylistId}`)

		check(rundownPlaylistId, String)
		return await serverAPI.reloadPlaylist(connection, event, rundownPlaylistId)
	}
)

sofieAPIRequest<{ playlistId: string }, never, void>(
	'put',
	'/playlists/:playlistId/reset-playlist',
	new Map([
		[404, UserErrorMessage.RundownPlaylistNotFound],
		[412, UserErrorMessage.RundownResetWhileActive],
	]),
	async (serverAPI, connection, event, params, _) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		logger.info(`API PUT: reset-playlist ${rundownPlaylistId}`)

		check(rundownPlaylistId, String)
		return await serverAPI.resetPlaylist(connection, event, rundownPlaylistId)
	}
)

sofieAPIRequest<{ playlistId: string }, { partId: string }, void>(
	'put',
	'/playlists/:playlistId/set-next-part',
	new Map([
		[404, UserErrorMessage.RundownPlaylistNotFound],
		[412, UserErrorMessage.PartNotFound],
	]),
	async (serverAPI, connection, event, params, body) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		const partId = protectString<PartId>(body.partId)
		logger.info(`API PUT: set-next-part ${rundownPlaylistId} ${partId}`)

		check(rundownPlaylistId, String)
		check(partId, String)
		return await serverAPI.setNextPart(connection, event, rundownPlaylistId, partId)
	}
)

sofieAPIRequest<{ playlistId: string }, { segmentId: string }, void>(
	'put',
	'/playlists/:playlistId/set-next-segment',
	new Map([
		[404, UserErrorMessage.RundownPlaylistNotFound],
		[412, UserErrorMessage.PartNotFound],
	]),
	async (serverAPI, connection, event, params, body) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		const segmentId = protectString<SegmentId>(body.segmentId)
		logger.info(`API PUT: set-next-segment ${rundownPlaylistId} ${segmentId}`)

		check(rundownPlaylistId, String)
		check(segmentId, String)
		return await serverAPI.setNextSegment(connection, event, rundownPlaylistId, segmentId)
	}
)

sofieAPIRequest<{ playlistId: string }, { fromPartInstanceId?: string }, void>(
	'post',
	'/playlists/:playlistId/take',
	new Map([
		[404, UserErrorMessage.RundownPlaylistNotFound],
		[412, UserErrorMessage.TakeNoNextPart],
	]),
	async (serverAPI, connection, event, params, body) => {
		const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
		const fromPartInstanceId = body.fromPartInstanceId
		logger.info(`API POST: take ${rundownPlaylistId}`)

		check(rundownPlaylistId, String)
		check(fromPartInstanceId, Match.Optional(String))
		return await serverAPI.take(connection, event, rundownPlaylistId, protectString(fromPartInstanceId))
	}
)

sofieAPIRequest<{ playlistId: string; sourceLayerId: string }, never, void>(
	'delete',
	'/playlists/:playlistId/sourceLayer/:sourceLayerId',
	new Map([
		[404, UserErrorMessage.RundownPlaylistNotFound],
		[412, UserErrorMessage.InactiveRundown],
	]),
	async (serverAPI, connection, event, params, _) => {
		const playlistId = protectString<RundownPlaylistId>(params.playlistId)
		const sourceLayerId = params.sourceLayerId
		logger.info(`API DELETE: sourceLayer ${playlistId} ${sourceLayerId}`)

		check(playlistId, String)
		check(sourceLayerId, String)
		return await serverAPI.clearSourceLayer(connection, event, playlistId, sourceLayerId)
	}
)

sofieAPIRequest<{ playlistId: string; sourceLayerId: string }, never, void>(
	'post',
	'/playlists/:playlistId/sourceLayer/:sourceLayerId/sticky',
	new Map([
		[404, UserErrorMessage.RundownPlaylistNotFound],
		[412, UserErrorMessage.InactiveRundown],
	]),
	async (serverAPI, connection, event, params, _) => {
		const playlistId = protectString<RundownPlaylistId>(params.playlistId)
		const sourceLayerId = params.sourceLayerId
		logger.info(`API POST: sourceLayer recallSticky ${playlistId} ${sourceLayerId}`)

		check(playlistId, String)
		check(sourceLayerId, String)
		return await serverAPI.recallStickyPiece(connection, event, playlistId, sourceLayerId)
	}
)

sofieAPIRequest<never, never, Array<{ id: string }>>(
	'get',
	'/devices',
	new Map(),
	async (serverAPI, connection, event, _params, _body) => {
		logger.info(`API GET: peripheral devices`)
		return await serverAPI.getPeripheralDevices(connection, event)
	}
)

sofieAPIRequest<{ deviceId: string }, never, APIPeripheralDevice>(
	'get',
	'/devices/:deviceId',
	new Map(),
	async (serverAPI, connection, event, params, _) => {
		const deviceId = protectString<PeripheralDeviceId>(params.deviceId)
		logger.info(`API GET: peripheral device ${deviceId}`)

		check(deviceId, String)
		return await serverAPI.getPeripheralDevice(connection, event, deviceId)
	}
)

sofieAPIRequest<{ deviceId: string }, { action: PeripheralDeviceAction }, void>(
	'post',
	'/devices/:deviceId/action',
	new Map(),
	async (serverAPI, connection, event, params, body) => {
		const deviceId = protectString<PeripheralDeviceId>(params.deviceId)
		const action = body.action
		logger.info(`API POST: peripheral device ${deviceId} action ${action.type}`)

		check(deviceId, String)
		check(action, Object)
		return await serverAPI.peripheralDeviceAction(connection, event, deviceId, body.action)
	}
)

sofieAPIRequest<never, never, Array<{ id: string }>>(
	'get',
	'/studios',
	new Map(),
	async (serverAPI, connection, event, _params, _) => {
		logger.info(`API GET: Studios`)
		return await serverAPI.getStudios(connection, event)
	}
)

sofieAPIRequest<{ studioId: string }, APIStudio, string>(
	'post',
	'/studios',
	new Map(),
	async (serverAPI, connection, event, _params, body) => {
		logger.info(`API POST: Add studio ${body.name}`)
		return await serverAPI.addStudio(connection, event, body)
	}
)

sofieAPIRequest<{ studioId: string }, never, APIStudio>(
	'get',
	'/studios/:studioId',
	new Map([[404, UserErrorMessage.StudioNotFound]]),
	async (serverAPI, connection, event, params, _) => {
		const studioId = protectString<StudioId>(params.studioId)
		logger.info(`API GET: studio ${studioId}`)

		check(studioId, String)
		return await serverAPI.getStudio(connection, event, studioId)
	}
)

sofieAPIRequest<{ studioId: string }, APIStudio, void>(
	'put',
	'/studios/:studioId',
	new Map([[404, UserErrorMessage.StudioNotFound]]),
	async (serverAPI, connection, event, params, body) => {
		const studioId = protectString<StudioId>(params.studioId)
		logger.info(`API PUT: Add or Update studio ${studioId} ${body.name}`)

		check(studioId, String)
		return await serverAPI.addOrUpdateStudio(connection, event, studioId, body)
	}
)

sofieAPIRequest<{ studioId: string }, never, void>(
	'delete',
	'/studios/:studioId',
	new Map([[404, UserErrorMessage.StudioNotFound]]),
	async (serverAPI, connection, event, params, _) => {
		const studioId = protectString<StudioId>(params.studioId)
		logger.info(`API DELETE: studio ${studioId}`)

		check(studioId, String)
		return await serverAPI.deleteStudio(connection, event, studioId)
	}
)

sofieAPIRequest<{ studioId: string }, never, Array<{ id: string }>>(
	'get',
	'/studios/:studioId/devices',
	new Map([[404, UserErrorMessage.StudioNotFound]]),
	async (serverAPI, connection, event, params, _) => {
		const studioId = protectString<StudioId>(params.studioId)
		logger.info(`API GET: peripheral devices for studio ${studioId}`)

		check(studioId, String)
		return await serverAPI.getPeripheralDevicesForStudio(connection, event, studioId)
	}
)

sofieAPIRequest<{ studioId: string }, { routeSetId: string; active: boolean }, void>(
	'put',
	'/studios/:studioId/switch-route-set',
	new Map([[404, UserErrorMessage.StudioNotFound]]),
	async (serverAPI, connection, event, params, body) => {
		const studioId = protectString<StudioId>(params.studioId)
		const routeSetId = body.routeSetId
		const active = body.active
		logger.info(`API PUT: switch-route-set ${studioId} ${routeSetId} ${active}`)

		check(studioId, String)
		check(routeSetId, String)
		check(active, Boolean)
		return await serverAPI.switchRouteSet(connection, event, studioId, routeSetId, active)
	}
)

sofieAPIRequest<{ studioId: string }, { deviceId: string }, void>(
	'put',
	'/studios/:studioId/devices',
	new Map([
		[404, UserErrorMessage.StudioNotFound],
		[412, UserErrorMessage.DeviceAlreadyAttachedToStudio],
	]),
	async (serverAPI, connection, events, params, body) => {
		const studioId = protectString<StudioId>(params.studioId)
		const deviceId = protectString<PeripheralDeviceId>(body.deviceId)
		logger.info(`API PUT: Attach device ${deviceId} to studio ${studioId}`)

		return await serverAPI.attachDeviceToStudio(connection, events, studioId, deviceId)
	}
)

sofieAPIRequest<{ studioId: string; deviceId: string }, never, void>(
	'delete',
	'/studios/:studioId/devices/:deviceId',
	new Map([[404, UserErrorMessage.StudioNotFound]]),
	async (serverAPI, connection, events, params, _) => {
		const studioId = protectString<StudioId>(params.studioId)
		const deviceId = protectString<PeripheralDeviceId>(params.deviceId)
		logger.info(`API DELETE: Detach device ${deviceId} from studio ${studioId}`)

		return await serverAPI.detachDeviceFromStudio(connection, events, studioId, deviceId)
	}
)

sofieAPIRequest<never, never, Array<{ id: string }>>(
	'get',
	'/blueprints',
	new Map(),
	async (serverAPI, connection, event, _params, _body) => {
		logger.info(`API GET: blueprints`)
		return await serverAPI.getAllBlueprints(connection, event)
	}
)

sofieAPIRequest<{ blueprintId: string }, never, APIBlueprint>(
	'get',
	'/blueprints/:blueprintId',
	new Map(),
	async (serverAPI, connection, event, params, _) => {
		const blueprintId = protectString<BlueprintId>(params.blueprintId)
		logger.info(`API GET: blueprint ${blueprintId}`)

		check(blueprintId, String)
		return await serverAPI.getBlueprint(connection, event, blueprintId)
	}
)

sofieAPIRequest<never, { blueprintId: string }, void>(
	'put',
	'/system/blueprint',
	new Map(),
	async (serverAPI, connection, events, _, body) => {
		const blueprintId = protectString<BlueprintId>(body.blueprintId)
		logger.info(`API PUT: system blueprint ${blueprintId}`)

		check(blueprintId, String)
		return await serverAPI.assignSystemBlueprint(connection, events, blueprintId)
	}
)

sofieAPIRequest<never, never, void>(
	'delete',
	'/system/blueprint',
	new Map(),
	async (serverAPI, connection, events, _params, _body) => {
		logger.info(`API DELETE: system blueprint`)

		return await serverAPI.unassignSystemBlueprint(connection, events)
	}
)

sofieAPIRequest<never, never, Array<{ id: string }>>(
	'get',
	'/showstyles',
	new Map(),
	async (serverAPI, connection, event, _params, _body) => {
		logger.info(`API GET: ShowStyleBases`)
		return await serverAPI.getShowStyleBases(connection, event)
	}
)

sofieAPIRequest<never, APIShowStyleBase, string>(
	'post',
	'/showstyles',
	new Map([[400, UserErrorMessage.BlueprintNotFound]]),
	async (serverAPI, connection, event, _params, body) => {
		logger.info(`API POST: Add ShowStyleBase ${body.name}`)
		return await serverAPI.addShowStyleBase(connection, event, body)
	}
)

sofieAPIRequest<{ showStyleBaseId: ShowStyleBaseId }, never, APIShowStyleBase>(
	'get',
	'/showstyles/:showStyleBaseId',
	new Map([[404, UserErrorMessage.BlueprintNotFound]]),
	async (serverAPI, connection, event, params, _body) => {
		logger.info(`API GET: ShowStyleBase ${params.showStyleBaseId}`)
		return await serverAPI.getShowStyleBase(connection, event, params.showStyleBaseId)
	}
)

sofieAPIRequest<{ showStyleBaseId: string }, APIShowStyleBase, void>(
	'put',
	'/showstyles/:showStyleBaseId',
	new Map([
		[400, UserErrorMessage.BlueprintNotFound],
		[412, UserErrorMessage.RundownAlreadyActive],
	]),
	async (serverAPI, connection, event, params, body) => {
		const showStyleBaseId = protectString<ShowStyleBaseId>(params.showStyleBaseId)
		logger.info(`API PUT: Add or Update ShowStyleBase ${showStyleBaseId}`)

		check(showStyleBaseId, String)
		return await serverAPI.addOrUpdateShowStyleBase(connection, event, showStyleBaseId, body)
	}
)

sofieAPIRequest<{ showStyleBaseId: string }, never, void>(
	'delete',
	'/showstyles/:showStyleBaseId',
	new Map([[412, UserErrorMessage.RundownAlreadyActive]]),
	async (serverAPI, connection, event, params, _body) => {
		const showStyleBaseId = protectString<ShowStyleBaseId>(params.showStyleBaseId)
		logger.info(`API DELETE: ShowStyleBase ${showStyleBaseId}`)

		check(showStyleBaseId, String)
		return await serverAPI.deleteShowStyleBase(connection, event, showStyleBaseId)
	}
)

sofieAPIRequest<{ showStyleBaseId: string }, never, Array<{ id: string }>>(
	'get',
	'/showstyles/:showStyleBaseId/variants',
	new Map([[404, UserErrorMessage.BlueprintNotFound]]),
	async (serverAPI, connection, event, params, _body) => {
		const showStyleBaseId = protectString<ShowStyleBaseId>(params.showStyleBaseId)
		logger.info(`API GET: ShowStyleVariants ${showStyleBaseId}`)

		check(showStyleBaseId, String)
		return await serverAPI.getShowStyleVariants(connection, event, showStyleBaseId)
	}
)

sofieAPIRequest<{ showStyleBaseId: string }, APIShowStyleVariant, string>(
	'post',
	'/showstyles/:showStyleBaseId/variants',
	new Map([[404, UserErrorMessage.BlueprintNotFound]]),
	async (serverAPI, connection, event, params, body) => {
		const showStyleBaseId = protectString<ShowStyleBaseId>(params.showStyleBaseId)
		logger.info(`API POST: Add ShowStyleVariant ${showStyleBaseId}`)

		check(showStyleBaseId, String)
		return await serverAPI.addShowStyleVariant(connection, event, showStyleBaseId, body)
	}
)

sofieAPIRequest<{ showStyleBaseId: string; showStyleVariantId: string }, never, APIShowStyleVariant>(
	'get',
	'/showstyles/:showStyleBaseId/variants/:showStyleVariantId',
	new Map([[404, UserErrorMessage.BlueprintNotFound]]),
	async (serverAPI, connection, event, params, _body) => {
		const showStyleBaseId = protectString<ShowStyleBaseId>(params.showStyleBaseId)
		const showStyleVariantId = protectString<ShowStyleVariantId>(params.showStyleVariantId)
		logger.info(`API GET: ShowStyleVariant ${showStyleBaseId} ${showStyleVariantId}`)

		check(showStyleBaseId, String)
		check(showStyleVariantId, String)
		return await serverAPI.getShowStyleVariant(connection, event, showStyleBaseId, showStyleVariantId)
	}
)

sofieAPIRequest<{ showStyleBaseId: string; showStyleVariantId: string }, APIShowStyleVariant, void>(
	'put',
	'/showstyles/:showStyleBaseId/variants/:showStyleVariantId',
	new Map([
		[400, UserErrorMessage.BlueprintNotFound],
		[404, UserErrorMessage.BlueprintNotFound],
		[412, UserErrorMessage.RundownAlreadyActive],
	]),
	async (serverAPI, connection, event, params, body) => {
		const showStyleBaseId = protectString<ShowStyleBaseId>(params.showStyleBaseId)
		const showStyleVariantId = protectString<ShowStyleVariantId>(params.showStyleVariantId)
		logger.info(`API PUT: Add or Update ShowStyleVariant ${showStyleBaseId} ${showStyleVariantId}`)

		check(showStyleBaseId, String)
		check(showStyleVariantId, String)
		return await serverAPI.addOrUpdateShowStyleVariant(connection, event, showStyleBaseId, showStyleVariantId, body)
	}
)

sofieAPIRequest<{ showStyleBaseId: string; showStyleVariantId: string }, never, void>(
	'delete',
	'/showstyles/:showStyleBaseId/variants/:showStyleVariantId',
	new Map([
		[404, UserErrorMessage.BlueprintNotFound],
		[412, UserErrorMessage.RundownAlreadyActive],
	]),
	async (serverAPI, connection, event, params, _body) => {
		const showStyleBaseId = protectString<ShowStyleBaseId>(params.showStyleBaseId)
		const showStyleVariantId = protectString<ShowStyleVariantId>(params.showStyleVariantId)
		logger.info(`API DELETE: ShowStyleVariant ${showStyleBaseId} ${showStyleVariantId}`)

		check(showStyleBaseId, String)
		check(showStyleVariantId, String)
		return await serverAPI.deleteShowStyleVariant(connection, event, showStyleBaseId, showStyleVariantId)
	}
)

sofieAPIRequest<{ studioId: string }, { action: StudioAction }, void>(
	'post',
	'/studios/{studioId}/action',
	new Map([[404, UserErrorMessage.StudioNotFound]]),
	async (serverAPI, connection, event, params, body) => {
		const studioId = protectString<StudioId>(params.studioId)
		const action = body.action
		logger.info(`API POST: Studio action ${studioId} ${body.action.type}`)

		check(studioId, String)
		check(action, Object)
		return await serverAPI.studioAction(connection, event, studioId, action)
	}
)

sofieAPIRequest<{ showStyleId: string }, { action: ShowStyleBaseAction }, void>(
	'put',
	'/studios/{showStyleBaseId}/actions',
	new Map([[404, UserErrorMessage.ShowStyleBaseNotFound]]),
	async (serverAPI, connection, event, params, body) => {
		const showStyleBaseId = protectString<ShowStyleBaseId>(params.showStyleId)
		const action = body.action
		logger.info(`API PUT: ShowStyleBase action ${showStyleBaseId} ${body.action.type}`)

		check(showStyleBaseId, String)
		check(action, Object)
		return await serverAPI.showStyleBaseAction(connection, event, showStyleBaseId, action)
	}
)

sofieAPIRequest<never, never, { inputs: PendingMigrations }>(
	'get',
	'/system/migrations',
	new Map(),
	async (serverAPI, connection, event, _params, _body) => {
		logger.info(`API GET: System migrations`)

		return await serverAPI.getPendingMigrations(connection, event)
	}
)

sofieAPIRequest<never, { inputs: MigrationData }, void>(
	'post',
	'/system/migrations',
	new Map([[400, UserErrorMessage.NoMigrationsToApply]]),
	async (serverAPI, connection, event, _params, body) => {
		const inputs = body.inputs
		logger.info(`API POST: System migrations`)

		check(inputs, Array)
		return await serverAPI.applyPendingMigrations(connection, event, inputs)
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
		close: () => {
			/* no-op */
		},
		onClose: () => {
			/* no-op */
		},
		clientAddress: ctx.req.headers.host || 'unknown',
		httpHeaders: ctx.req.headers as Record<string, string>,
	}
}

Meteor.startup(() => {
	const app = new Koa()
	if (!Meteor.isAppTest) {
		// Expose the API at the url /api/v1.0
		WebApp.connectHandlers.use('/api/v1.0', Meteor.bindEnvironment(app.callback()))
		// Redirect `/api/latest` to the most recent API version
		WebApp.connectHandlers.use(function (req, res, next) {
			const path = req.url
			if (path == '/api/latest') {
				res.writeHead(307, { Location: '/api/v1.0' })
				res.end()
			} else next()
		})
	}
	app.use(async (ctx, next) => {
		// Strange - sometimes a JSON body gets parsed by Koa before here (eg for a POST call?).
		if (typeof ctx.req.body === 'object') {
			ctx.disableBodyParser = true
			ctx.request.body = { ...ctx.req.body }
		}
		await next()
	})
	app.use(cors())
	app.use(bodyParser()).use(koaRouter.routes()).use(koaRouter.allowedMethods())
})
