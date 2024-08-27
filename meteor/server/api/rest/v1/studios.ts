import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { logger } from '../../../logging'
import { APIFactory, APIRegisterHook, ServerAPIContext } from './types'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { check } from '../../../../lib/check'
import { APIStudio, StudioAction, StudioActionType, StudiosRestAPI } from '../../../../lib/api/rest/v1'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '../../../../lib/api/client'
import { PeripheralDevices, RundownPlaylists, Studios } from '../../../collections'
import { APIStudioFrom, studioFrom } from './typeConversion'
import { runUpgradeForStudio, validateConfigForStudio } from '../../../migration/upgrades'
import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ServerClientAPI } from '../../client'
import { assertNever, getCurrentTime } from '../../../../lib/lib'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { StudioContentWriteAccess } from '../../../security/studio'
import { ServerPlayoutAPI } from '../../playout/playout'

class StudiosServerAPI implements StudiosRestAPI {
	constructor(private context: ServerAPIContext) {}

	async getStudios(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>> {
		const studios = (await Studios.findFetchAsync({}, { projection: { _id: 1 } })) as Array<Pick<DBStudio, '_id'>>

		return ClientAPI.responseSuccess(studios.map((studio) => ({ id: unprotectString(studio._id) })))
	}

	async addStudio(
		_connection: Meteor.Connection,
		_event: string,
		studio: APIStudio
	): Promise<ClientAPI.ClientResponse<string>> {
		const newStudio = await studioFrom(studio)
		if (!newStudio) throw new Meteor.Error(400, `Invalid Studio`)

		const newStudioId = await Studios.insertAsync(newStudio)

		const validation = await validateConfigForStudio(newStudioId)
		const validateOK = validation.messages.reduce((acc, msg) => acc && msg.level === NoteSeverity.INFO, true)
		if (!validateOK) {
			const details = JSON.stringify(
				validation.messages.filter((msg) => msg.level < NoteSeverity.INFO).map((msg) => msg.message.key),
				null,
				2
			)
			logger.error(`addStudio failed validation with errors: ${details}`)
			throw new Meteor.Error(409, `Studio ${newStudioId} has failed validation`, details)
		}

		await runUpgradeForStudio(newStudioId)
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
			)) as Array<Pick<DBRundownPlaylist, 'activationId'>>
			if (playlists.some((p) => p.activationId !== undefined)) {
				throw new Meteor.Error(412, `Studio ${studioId} cannot be updated, it is in use in an active Playlist`)
			}
		}

		await Studios.upsertAsync(studioId, newStudio)

		const validation = await validateConfigForStudio(studioId)
		const validateOK = validation.messages.reduce((acc, msg) => acc && msg.level === NoteSeverity.INFO, true)
		if (!validateOK) {
			const details = JSON.stringify(
				validation.messages.filter((msg) => msg.level < NoteSeverity.INFO).map((msg) => msg.message.key),
				null,
				2
			)
			logger.error(`addOrUpdateStudio failed validation with errors: ${details}`)
			throw new Meteor.Error(409, `Studio ${studioId} has failed validation`, details)
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
			)) as Array<Pick<DBRundownPlaylist, 'activationId'>>
			if (playlists.some((p) => p.activationId !== undefined)) {
				throw new Meteor.Error(412, `Studio ${studioId} cannot be deleted, it is in use in an active Playlist`)
			}
		}

		await PeripheralDevices.updateAsync({ studioId }, { $unset: { studioId: 1 } }, { multi: true })

		const rundownPlaylists = (await RundownPlaylists.findFetchAsync(
			{ studioId },
			{
				projection: {
					_id: 1,
				},
			}
		)) as Array<Pick<DBRundownPlaylist, '_id'>>

		const promises = rundownPlaylists.map(async (rundownPlaylist) =>
			ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
				this.context.getMethodContext(connection),
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

	async switchRouteSet(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId,
		routeSetId: string,
		state: boolean
	) {
		return ServerClientAPI.runUserActionInLog(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			'switchRouteSet',
			{ studioId, routeSetId, state },
			async () => {
				check(studioId, String)
				check(routeSetId, String)
				check(state, Boolean)

				const access = await StudioContentWriteAccess.routeSet(this.context.getCredentials(), studioId)
				return ServerPlayoutAPI.switchRouteSet(access, routeSetId, state)
			}
		)
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
}

class StudiosAPIFactory implements APIFactory<StudiosRestAPI> {
	createServerAPI(context: ServerAPIContext): StudiosRestAPI {
		return new StudiosServerAPI(context)
	}
}

export function registerRoutes(registerRoute: APIRegisterHook<StudiosRestAPI>): void {
	const studiosAPIFactory = new StudiosAPIFactory()

	registerRoute<never, never, Array<{ id: string }>>(
		'get',
		'/studios',
		new Map(),
		studiosAPIFactory,
		async (serverAPI, connection, event, _params, _) => {
			logger.info(`API GET: Studios`)
			return await serverAPI.getStudios(connection, event)
		}
	)

	registerRoute<{ studioId: string }, APIStudio, string>(
		'post',
		'/studios',
		new Map(),
		studiosAPIFactory,
		async (serverAPI, connection, event, _params, body) => {
			logger.info(`API POST: Add studio ${body.name}`)
			return await serverAPI.addStudio(connection, event, body)
		}
	)

	registerRoute<{ studioId: string }, never, APIStudio>(
		'get',
		'/studios/:studioId',
		new Map([[404, [UserErrorMessage.StudioNotFound]]]),
		studiosAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			const studioId = protectString<StudioId>(params.studioId)
			logger.info(`API GET: studio ${studioId}`)

			check(studioId, String)
			return await serverAPI.getStudio(connection, event, studioId)
		}
	)

	registerRoute<{ studioId: string }, APIStudio, void>(
		'put',
		'/studios/:studioId',
		new Map([
			[404, [UserErrorMessage.StudioNotFound]],
			[409, [UserErrorMessage.ValidationFailed]],
		]),
		studiosAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const studioId = protectString<StudioId>(params.studioId)
			logger.info(`API PUT: Add or Update studio ${studioId} ${body.name}`)

			check(studioId, String)
			return await serverAPI.addOrUpdateStudio(connection, event, studioId, body)
		}
	)

	registerRoute<{ studioId: string }, never, void>(
		'delete',
		'/studios/:studioId',
		new Map([[404, [UserErrorMessage.StudioNotFound]]]),
		studiosAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			const studioId = protectString<StudioId>(params.studioId)
			logger.info(`API DELETE: studio ${studioId}`)

			check(studioId, String)
			return await serverAPI.deleteStudio(connection, event, studioId)
		}
	)

	registerRoute<{ studioId: string }, never, Array<{ id: string }>>(
		'get',
		'/studios/:studioId/devices',
		new Map([[404, [UserErrorMessage.StudioNotFound]]]),
		studiosAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			const studioId = protectString<StudioId>(params.studioId)
			logger.info(`API GET: peripheral devices for studio ${studioId}`)

			check(studioId, String)
			return await serverAPI.getPeripheralDevicesForStudio(connection, event, studioId)
		}
	)

	registerRoute<{ studioId: string }, { routeSetId: string; active: boolean }, void>(
		'put',
		'/studios/:studioId/switch-route-set',
		new Map([[404, [UserErrorMessage.StudioNotFound]]]),
		studiosAPIFactory,
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

	registerRoute<{ studioId: string }, { deviceId: string }, void>(
		'put',
		'/studios/:studioId/devices',
		new Map([
			[404, [UserErrorMessage.StudioNotFound]],
			[412, [UserErrorMessage.DeviceAlreadyAttachedToStudio]],
		]),
		studiosAPIFactory,
		async (serverAPI, connection, events, params, body) => {
			const studioId = protectString<StudioId>(params.studioId)
			const deviceId = protectString<PeripheralDeviceId>(body.deviceId)
			logger.info(`API PUT: Attach device ${deviceId} to studio ${studioId}`)

			return await serverAPI.attachDeviceToStudio(connection, events, studioId, deviceId)
		}
	)

	registerRoute<{ studioId: string; deviceId: string }, never, void>(
		'delete',
		'/studios/:studioId/devices/:deviceId',
		new Map([[404, [UserErrorMessage.StudioNotFound]]]),
		studiosAPIFactory,
		async (serverAPI, connection, events, params, _) => {
			const studioId = protectString<StudioId>(params.studioId)
			const deviceId = protectString<PeripheralDeviceId>(params.deviceId)
			logger.info(`API DELETE: Detach device ${deviceId} from studio ${studioId}`)

			return await serverAPI.detachDeviceFromStudio(connection, events, studioId, deviceId)
		}
	)

	registerRoute<{ studioId: string }, { action: StudioAction }, void>(
		'post',
		'/studios/{studioId}/action',
		new Map([[404, [UserErrorMessage.StudioNotFound]]]),
		studiosAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const studioId = protectString<StudioId>(params.studioId)
			const action = body.action
			logger.info(`API POST: Studio action ${studioId} ${body.action.type}`)

			check(studioId, String)
			check(action, Object)
			return await serverAPI.studioAction(connection, event, studioId, action)
		}
	)
}
