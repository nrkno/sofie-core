import { Meteor } from 'meteor/meteor'
import { check, Match } from '../../lib/check'
import * as _ from 'underscore'
import { PeripheralDeviceAPI, NewPeripheralDeviceAPI, PeripheralDeviceAPIMethods } from '../../lib/api/peripheralDevice'
import {
	PeripheralDevices,
	PeripheralDeviceId,
	PeripheralDeviceType,
	PeripheralDevice,
} from '../../lib/collections/PeripheralDevices'
import { Rundowns } from '../../lib/collections/Rundowns'
import { getCurrentTime, protectString, makePromise, stringifyObjects } from '../../lib/lib'
import { PeripheralDeviceCommands, PeripheralDeviceCommandId } from '../../lib/collections/PeripheralDeviceCommands'
import { logger } from '../logging'
import { TimelineHash } from '../../lib/collections/Timeline'
import { registerClassToMeteorMethods } from '../methods'
import { IncomingMessage, ServerResponse } from 'http'
import { URL } from 'url'
import { RundownInput } from './ingest/rundownInput'
import {
	IngestRundown,
	IngestSegment,
	IngestPart,
	ExpectedPackageStatusAPI,
	PackageInfo,
	StatusCode,
} from '@sofie-automation/blueprints-integration'
import { MosIntegration } from './ingest/mosDevice/mosIntegration'
import { MediaScannerIntegration } from './integration/media-scanner'
import { MediaObject } from '../../lib/collections/MediaObjects'
import { MediaManagerIntegration } from './integration/mediaWorkFlows'
import { MediaWorkFlowId, MediaWorkFlow } from '../../lib/collections/MediaWorkFlows'
import { MediaWorkFlowStepId, MediaWorkFlowStep } from '../../lib/collections/MediaWorkFlowSteps'
import { MOS } from '@sofie-automation/corelib'
import { determineDiffTime } from './systemTime/systemTime'
import { getTimeDiff } from './systemTime/api'
import { PeripheralDeviceContentWriteAccess } from '../security/peripheralDevice'
import { MethodContextAPI, MethodContext } from '../../lib/api/methods'
import { triggerWriteAccess, triggerWriteAccessBecauseNoCheckNecessary } from '../security/lib/securityVerify'
import { checkAccessAndGetPeripheralDevice } from './ingest/lib'
import { PickerPOST } from './http'
import { UserActionsLog, UserActionsLogItem } from '../../lib/collections/UserActionsLog'
import { PackageManagerIntegration } from './integration/expectedPackages'
import { ExpectedPackageId } from '../../lib/collections/ExpectedPackages'
import { ExpectedPackageWorkStatusId } from '../../lib/collections/ExpectedPackageWorkStatuses'
import { profiler } from './profiler'
import { QueueStudioJob } from '../worker/worker'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { ConfigManifestEntryType, TableConfigManifestEntry } from '../../lib/api/deviceConfig'

const apmNamespace = 'peripheralDevice'
export namespace ServerPeripheralDeviceAPI {
	export function initialize(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		token: string,
		options: PeripheralDeviceAPI.InitOptions
	): PeripheralDeviceId {
		triggerWriteAccess() // This is somewhat of a hack, since we want to check if it exists at all, before checking access
		check(deviceId, String)
		const existingDevice = PeripheralDevices.findOne(deviceId)
		if (existingDevice) {
			PeripheralDeviceContentWriteAccess.peripheralDevice({ userId: context.userId, token }, deviceId)
		}

		check(token, String)
		check(options, Object)
		check(options.name, String)
		check(options.category, String)
		check(options.type, String)
		check(options.subType, Match.OneOf(Number, String))
		check(options.parentDeviceId, Match.Optional(String))
		check(options.versions, Match.Optional(Object))

		// Omitting some of the properties that tend to be rather large
		logger.debug('Initialize device ' + deviceId, _.omit(options, 'versions', 'configManifest'))

		if (existingDevice) {
			const newVersionsStr = stringifyObjects(options.versions)
			const oldVersionsStr = stringifyObjects(existingDevice.versions)

			PeripheralDevices.update(deviceId, {
				$set: {
					lastSeen: getCurrentTime(),
					lastConnected: getCurrentTime(),
					connected: true,
					connectionId: options.connectionId,

					category: options.category,
					type: options.type,
					subType: options.subType,

					name:
						// Only allow name changes if the name is unmodified:
						existingDevice.name === existingDevice.deviceName || existingDevice.deviceName === undefined
							? options.name
							: existingDevice.name,
					deviceName: options.name,
					parentDeviceId: options.parentDeviceId,
					versions: options.versions,

					configManifest: options.configManifest,
				},
				$unset:
					newVersionsStr !== oldVersionsStr
						? {
								disableVersionChecks: 1,
						  }
						: undefined,
			})
		} else {
			PeripheralDevices.insert({
				_id: deviceId,
				organizationId: null,
				created: getCurrentTime(),
				status: {
					statusCode: StatusCode.UNKNOWN,
				},
				studioId: protectString(''),
				connected: true,
				connectionId: options.connectionId,
				lastSeen: getCurrentTime(),
				lastConnected: getCurrentTime(),
				token: token,

				category: options.category,
				type: options.type,
				subType: options.subType,

				name: options.name,
				deviceName: options.name,
				parentDeviceId: options.parentDeviceId,
				versions: options.versions,
				// settings: {},

				configManifest: options.configManifest,
			})
		}
		return deviceId
	}
	export function unInitialize(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		token: string
	): PeripheralDeviceId {
		checkAccessAndGetPeripheralDevice(deviceId, token, context)

		// TODO: Add an authorization for this?

		PeripheralDevices.remove(deviceId)
		return deviceId
	}
	export function setStatus(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		token: string,
		status: PeripheralDeviceAPI.StatusObject
	): PeripheralDeviceAPI.StatusObject {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, token, context)

		check(deviceId, String)
		check(token, String)
		check(status, Object)
		check(status.statusCode, Number)
		if (status.statusCode < StatusCode.UNKNOWN || status.statusCode > StatusCode.FATAL) {
			throw new Meteor.Error(400, 'device status code is not known')
		}

		// check if we have to update something:
		if (!_.isEqual(status, peripheralDevice.status)) {
			logger.info(
				`Changed status of device ${peripheralDevice._id} "${peripheralDevice.name}" to ${status.statusCode}`
			)
			// perform the update:
			PeripheralDevices.update(deviceId, {
				$set: {
					status: status,
					connected: true,
				},
			})
		} else if (!peripheralDevice.connected) {
			PeripheralDevices.update(deviceId, {
				$set: {
					connected: true,
				},
			})
		}
		return status
	}
	export function ping(context: MethodContext, deviceId: PeripheralDeviceId, token: string): void {
		checkAccessAndGetPeripheralDevice(deviceId, token, context)

		check(deviceId, String)
		check(token, String)

		// Update lastSeen
		PeripheralDevices.update(deviceId, {
			$set: {
				lastSeen: getCurrentTime(),
			},
		})
	}
	export function getPeripheralDevice(context: MethodContext, deviceId: PeripheralDeviceId, token: string) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, token, context)

		return peripheralDevice
	}

	/**
	 * Called from Playout-gateway when the trigger-time of a timeline object has updated
	 * ( typically when using the "now"-feature )
	 */
	export async function timelineTriggerTime(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		token: string,
		results: PeripheralDeviceAPI.TimelineTriggerTimeResult
	): Promise<void> {
		const transaction = profiler.startTransaction('timelineTriggerTime', apmNamespace)

		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, token, context)

		if (!peripheralDevice.studioId)
			throw new Meteor.Error(401, `peripheralDevice "${deviceId}" not attached to a studio`)

		// check(r.time, Number)
		check(results, Array)
		_.each(results, (o) => {
			check(o.id, String)
			check(o.time, Number)
		})

		if (results.length > 0) {
			const job = await QueueStudioJob(StudioJobs.OnTimelineTriggerTime, peripheralDevice.studioId, {
				results,
			})
			await job.complete
		}

		transaction?.end()
	}

	export async function partPlaybackStarted(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		token: string,
		r: PeripheralDeviceAPI.PartPlaybackStartedResult
	): Promise<void> {
		const transaction = profiler.startTransaction('partPlaybackStarted', apmNamespace)

		// This is called from the playout-gateway when a part starts playing.
		// Note that this function can / might be called several times from playout-gateway for the same part
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, token, context)

		check(r.time, Number)
		check(r.rundownPlaylistId, String)
		check(r.partInstanceId, String)

		if (!peripheralDevice.studioId)
			throw new Error(`PeripheralDevice "${peripheralDevice._id}" sent piecePlaybackStarted, but has no studioId`)

		const job = await QueueStudioJob(StudioJobs.OnPartPlaybackStarted, peripheralDevice.studioId, {
			playlistId: r.rundownPlaylistId,
			partInstanceId: r.partInstanceId,
			startedPlayback: r.time,
		})
		await job.complete

		transaction?.end()
	}
	export async function partPlaybackStopped(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		token: string,
		r: PeripheralDeviceAPI.PartPlaybackStoppedResult
	): Promise<void> {
		const transaction = profiler.startTransaction('partPlaybackStopped', apmNamespace)

		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, token, context)

		check(r.time, Number)
		check(r.rundownPlaylistId, String)
		check(r.partInstanceId, String)

		if (!peripheralDevice.studioId)
			throw new Error(`PeripheralDevice "${peripheralDevice._id}" sent piecePlaybackStarted, but has no studioId`)

		const job = await QueueStudioJob(StudioJobs.OnPartPlaybackStopped, peripheralDevice.studioId, {
			playlistId: r.rundownPlaylistId,
			partInstanceId: r.partInstanceId,
			stoppedPlayback: r.time,
		})
		await job.complete

		transaction?.end()
	}
	export async function piecePlaybackStarted(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		token: string,
		r: PeripheralDeviceAPI.PiecePlaybackStartedResult
	): Promise<void> {
		const transaction = profiler.startTransaction('piecePlaybackStarted', apmNamespace)

		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, token, context)

		check(r.time, Number)
		check(r.rundownPlaylistId, String)
		check(r.pieceInstanceId, String)
		check(r.dynamicallyInserted, Match.Optional(Boolean))

		if (!peripheralDevice.studioId)
			throw new Error(`PeripheralDevice "${peripheralDevice._id}" sent piecePlaybackStarted, but has no studioId`)

		const job = await QueueStudioJob(StudioJobs.OnPiecePlaybackStarted, peripheralDevice.studioId, {
			playlistId: r.rundownPlaylistId,
			pieceInstanceId: r.pieceInstanceId,
			startedPlayback: r.time,
		})
		await job.complete

		transaction?.end()
	}
	export async function piecePlaybackStopped(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		token: string,
		r: PeripheralDeviceAPI.PiecePlaybackStartedResult
	): Promise<void> {
		const transaction = profiler.startTransaction('piecePlaybackStopped', apmNamespace)

		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, token, context)

		check(r.time, Number)
		check(r.rundownPlaylistId, String)
		check(r.pieceInstanceId, String)
		check(r.dynamicallyInserted, Match.Optional(Boolean))

		if (!peripheralDevice.studioId)
			throw new Error(`PeripheralDevice "${peripheralDevice._id}" sent piecePlaybackStarted, but has no studioId`)

		const job = await QueueStudioJob(StudioJobs.OnPiecePlaybackStopped, peripheralDevice.studioId, {
			playlistId: r.rundownPlaylistId,
			pieceInstanceId: r.pieceInstanceId,
			stoppedPlayback: r.time,
		})
		await job.complete

		transaction?.end()
	}
	export function pingWithCommand(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		token: string,
		message: string,
		cb?: Function
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, token, context)

		PeripheralDeviceAPI.executeFunction(peripheralDevice._id, 'pingResponse', message)
			.then((res) => {
				if (cb) cb(null, res)
			})
			.catch((err) => {
				logger.warn(err)

				if (cb) cb(err, null)
			})

		ping(context, deviceId, token)
	}
	export function killProcess(context: MethodContext, deviceId: PeripheralDeviceId, token: string, really: boolean) {
		// This is used in integration tests only
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, token, context)

		// Make sure this never runs if this server isn't empty:
		if (Rundowns.find().count()) throw new Meteor.Error(400, 'Unable to run killProcess: Rundowns not empty!')

		if (really) {
			this.logger.info('KillProcess command received from ' + peripheralDevice._id + ', shutting down in 1000ms!')
			setTimeout(() => {
				// eslint-disable-next-line no-process-exit
				process.exit(0)
			}, 1000)
			return true
		}
		return false
	}
	export function disableSubDevice(
		access: PeripheralDeviceContentWriteAccess.ContentAccess,
		subDeviceId: string,
		disable: boolean
	) {
		const peripheralDevice = access.device
		const deviceId = access.deviceId

		// check that the peripheralDevice has subDevices
		if (!peripheralDevice.settings)
			throw new Meteor.Error(405, `PeripheralDevice "${deviceId}" does not provide a settings object`)
		if (!peripheralDevice.configManifest)
			throw new Meteor.Error(405, `PeripheralDevice "${deviceId}" does not provide a configuration manifest`)

		const subDevicesProp = peripheralDevice.configManifest.deviceConfig.find(
			(prop) => prop.type === ConfigManifestEntryType.TABLE && prop.isSubDevices === true
		) as TableConfigManifestEntry | undefined

		if (!subDevicesProp)
			throw new Meteor.Error(
				405,
				`PeripheralDevice "${deviceId}" does not provide a subDevices configuration property`
			)

		const subDevicesPropId = subDevicesProp.id

		const subDevices = peripheralDevice.settings[subDevicesPropId]
		if (!subDevices) throw new Meteor.Error(500, `PeripheralDevice "${deviceId}" has a malformed settings object`)

		// check if the subDevice supports disabling using the magical 'disable' BOOLEAN property.
		const subDeviceSettings = subDevices[subDeviceId] as Record<string, any> | undefined
		if (!subDeviceSettings)
			throw new Meteor.Error(404, `PeripheralDevice "${deviceId}", subDevice "${subDeviceId}" is not configured`)

		const subDeviceType = subDeviceSettings[subDevicesProp.typeField || 'type']
		const subDeviceSettingTopology = subDevicesProp.config[subDeviceType]

		const hasDisableProperty = subDeviceSettingTopology.find(
			(prop) => prop.id === 'disable' && prop.type === ConfigManifestEntryType.BOOLEAN
		)
		if (!hasDisableProperty)
			throw new Meteor.Error(
				405,
				`PeripheralDevice "${deviceId}, subDevice "${subDeviceId}" of type "${subDeviceType}" does not support the disable property`
			)

		PeripheralDevices.update(deviceId, {
			$set: {
				[`settings.${subDevicesPropId}.${subDeviceId}.disable`]: disable,
			},
		})
	}
	export function testMethod(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		token: string,
		returnValue: string,
		throwError?: boolean
	): string {
		// used for integration tests with core-connection
		checkAccessAndGetPeripheralDevice(deviceId, token, context)

		check(deviceId, String)
		check(token, String)
		check(returnValue, String)

		if (throwError) {
			throw new Meteor.Error(418, 'Error thrown, as requested')
		} else {
			return returnValue
		}
	}

	export function requestUserAuthToken(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		token: string,
		authUrl: string
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, token, context)

		if (peripheralDevice.type !== PeripheralDeviceType.SPREADSHEET) {
			throw new Meteor.Error(400, 'can only request user auth token for peripheral device of spreadsheet type')
		}
		check(authUrl, String)

		PeripheralDevices.update(peripheralDevice._id, {
			$set: {
				accessTokenUrl: authUrl,
			},
		})
	}
	export function storeAccessToken(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		token: string,
		accessToken: any
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, token, context)

		if (peripheralDevice.type !== PeripheralDeviceType.SPREADSHEET) {
			throw new Meteor.Error(400, 'can only store access token for peripheral device of spreadsheet type')
		}

		PeripheralDevices.update(peripheralDevice._id, {
			$set: {
				accessTokenUrl: '',
				'secretSettings.accessToken': accessToken,
				'settings.secretAccessToken': true,
			},
		})
	}
	export function removePeripheralDevice(context: MethodContext, deviceId: PeripheralDeviceId, token?: string) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, token, context)

		logger.info(`Removing PeripheralDevice ${peripheralDevice._id}`)

		PeripheralDevices.remove(peripheralDevice._id)
		PeripheralDevices.remove({
			parentDeviceId: peripheralDevice._id,
		})
		PeripheralDeviceCommands.remove({
			deviceId: peripheralDevice._id,
		})
		// TODO: add others here (MediaWorkflows, etc?)
	}
	export async function reportResolveDone(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		timelineHash: TimelineHash,
		/** Resolve duration, as reported by playout-gateway/TSR */
		resolveDuration: number
	): Promise<void> {
		// Device (playout gateway) reports that it has finished resolving a timeline
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)

		check(timelineHash, String)
		check(resolveDuration, Number)

		// Look up the userAction associated with this timelineHash.
		// We're using that to determine when the timeline was generated (in Core)
		// In order to determine the total latency (roundtrip from timeline-generation => resolving done in playout-gateway)
		const userAction = (await UserActionsLog.findOneAsync(
			{
				timelineHash: timelineHash,
			},
			{
				fields: {
					timelineGenerated: 1,
				},
			}
		)) as Pick<UserActionsLogItem, '_id' | 'timelineGenerated'>

		// Compare the timelineHash with the one we have in the timeline.

		if (userAction && userAction.timelineGenerated) {
			/** Time when timeline was generated in Core */
			const startTime = userAction.timelineGenerated
			const endTime = getCurrentTime()

			const totalLatency = endTime - startTime

			await updatePeripheralDeviceLatency(totalLatency, peripheralDevice)

			// Also store the result to the userAction:
			await UserActionsLog.updateAsync(userAction._id, {
				$push: {
					gatewayDuration: totalLatency,
					timelineResolveDuration: resolveDuration,
				},
			})
		}
	}
}

PickerPOST.route('/devices/:deviceId/uploadCredentials', (params, req: IncomingMessage, res: ServerResponse) => {
	res.setHeader('Content-Type', 'text/plain')

	let content = ''
	try {
		const deviceId: PeripheralDeviceId = protectString(decodeURIComponent(params.deviceId))
		check(deviceId, String)

		if (!deviceId) throw new Meteor.Error(400, `parameter deviceId is missing`)

		const peripheralDevice = PeripheralDevices.findOne(deviceId)
		if (!peripheralDevice) throw new Meteor.Error(404, `Peripheral device "${deviceId}" not found`)

		const url = new URL(req.url || '', 'http://localhost')

		const fileNames = url.searchParams.get('name') || undefined
		const fileName: string = (_.isArray(fileNames) ? fileNames[0] : fileNames) || ''

		check(fileName, String)

		const body = (req as any).body
		if (!body) throw new Meteor.Error(400, 'Upload credentials: Missing request body')

		if (typeof body !== 'string' || body.length < 10)
			throw new Meteor.Error(400, 'Upload credentials: Invalid request body')

		logger.info('Upload credentails, ' + body.length + ' bytes')

		const credentials = JSON.parse(body)

		PeripheralDevices.update(peripheralDevice._id, {
			$set: {
				'secretSettings.credentials': credentials,
				'settings.secretCredentials': true,
			},
		})

		res.statusCode = 200
	} catch (e) {
		res.statusCode = 500
		content = e + ''
		logger.error('Upload credentials failed: ' + e)
	}

	res.end(content)
})

async function updatePeripheralDeviceLatency(totalLatency: number, peripheralDevice: PeripheralDevice) {
	/** How many latencies we store for statistics */
	const LATENCIES_MAX_LENGTH = 100

	/** Any latency higher than this is not realistic */
	const MAX_REALISTIC_LATENCY = 3000 // ms

	if (totalLatency < MAX_REALISTIC_LATENCY) {
		if (!peripheralDevice.latencies) peripheralDevice.latencies = []
		peripheralDevice.latencies.unshift(totalLatency)

		if (peripheralDevice.latencies.length > LATENCIES_MAX_LENGTH) {
			// Trim anything after LATENCIES_MAX_LENGTH
			peripheralDevice.latencies.splice(LATENCIES_MAX_LENGTH, 999)
		}
		await PeripheralDevices.updateAsync(peripheralDevice._id, {
			$set: {
				latencies: peripheralDevice.latencies,
			},
		})
	}
}

/** WHen a device has executed a PeripheralDeviceCommand, it will reply to this endpoint with the result */
function functionReply(
	context: MethodContext,
	deviceId: PeripheralDeviceId,
	deviceToken: string,
	commandId: PeripheralDeviceCommandId,
	err: any,
	result: any
): void {
	const device = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)

	// logger.debug('functionReply', err, result)
	PeripheralDeviceCommands.update(
		{
			_id: commandId,
			deviceId: { $in: _.compact([device._id, device.parentDeviceId]) },
		},
		{
			$set: {
				hasReply: true,
				reply: result,
				replyError: err,
				replyTime: getCurrentTime(),
			},
		}
	)
}

// Set up ALL PeripheralDevice methods:
class ServerPeripheralDeviceAPIClass extends MethodContextAPI implements NewPeripheralDeviceAPI {
	// -------- System time --------
	async determineDiffTime() {
		triggerWriteAccessBecauseNoCheckNecessary()
		return determineDiffTime()
	}
	async getTimeDiff() {
		triggerWriteAccessBecauseNoCheckNecessary()
		return makePromise(() => getTimeDiff())
	}
	async getTime() {
		triggerWriteAccessBecauseNoCheckNecessary()
		return makePromise(() => getCurrentTime())
	}

	// ----- PeripheralDevice --------------
	async functionReply(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		commandId: PeripheralDeviceCommandId,
		err: any,
		result: any
	) {
		return makePromise(() => functionReply(this, deviceId, deviceToken, commandId, err, result))
	}
	async initialize(deviceId: PeripheralDeviceId, deviceToken: string, options: PeripheralDeviceAPI.InitOptions) {
		return makePromise(() => ServerPeripheralDeviceAPI.initialize(this, deviceId, deviceToken, options))
	}
	async unInitialize(deviceId: PeripheralDeviceId, deviceToken: string) {
		return makePromise(() => ServerPeripheralDeviceAPI.unInitialize(this, deviceId, deviceToken))
	}
	async setStatus(deviceId: PeripheralDeviceId, deviceToken: string, status: PeripheralDeviceAPI.StatusObject) {
		return makePromise(() => ServerPeripheralDeviceAPI.setStatus(this, deviceId, deviceToken, status))
	}
	async ping(deviceId: PeripheralDeviceId, deviceToken: string) {
		return makePromise(() => ServerPeripheralDeviceAPI.ping(this, deviceId, deviceToken))
	}
	async getPeripheralDevice(deviceId: PeripheralDeviceId, deviceToken: string) {
		return makePromise(() => ServerPeripheralDeviceAPI.getPeripheralDevice(this, deviceId, deviceToken))
	}
	async pingWithCommand(deviceId: PeripheralDeviceId, deviceToken: string, message: string, cb?: Function) {
		return makePromise(() => ServerPeripheralDeviceAPI.pingWithCommand(this, deviceId, deviceToken, message, cb))
	}
	async killProcess(deviceId: PeripheralDeviceId, deviceToken: string, really: boolean) {
		return makePromise(() => ServerPeripheralDeviceAPI.killProcess(this, deviceId, deviceToken, really))
	}
	async testMethod(deviceId: PeripheralDeviceId, deviceToken: string, returnValue: string, throwError?: boolean) {
		return makePromise(() =>
			ServerPeripheralDeviceAPI.testMethod(this, deviceId, deviceToken, returnValue, throwError)
		)
	}
	async removePeripheralDevice(deviceId: PeripheralDeviceId, token?: string) {
		return makePromise(() => ServerPeripheralDeviceAPI.removePeripheralDevice(this, deviceId, token))
	}

	// ------ Playout Gateway --------
	async timelineTriggerTime(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		r: PeripheralDeviceAPI.TimelineTriggerTimeResult
	) {
		return ServerPeripheralDeviceAPI.timelineTriggerTime(this, deviceId, deviceToken, r)
	}
	async partPlaybackStarted(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		r: PeripheralDeviceAPI.PartPlaybackStartedResult
	) {
		return ServerPeripheralDeviceAPI.partPlaybackStarted(this, deviceId, deviceToken, r)
	}
	async partPlaybackStopped(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		r: PeripheralDeviceAPI.PartPlaybackStartedResult
	) {
		return ServerPeripheralDeviceAPI.partPlaybackStopped(this, deviceId, deviceToken, r)
	}
	async piecePlaybackStopped(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		r: PeripheralDeviceAPI.PiecePlaybackStartedResult
	) {
		return ServerPeripheralDeviceAPI.piecePlaybackStopped(this, deviceId, deviceToken, r)
	}
	async piecePlaybackStarted(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		r: PeripheralDeviceAPI.PiecePlaybackStartedResult
	) {
		return ServerPeripheralDeviceAPI.piecePlaybackStarted(this, deviceId, deviceToken, r)
	}
	async reportResolveDone(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		timelineHash: TimelineHash,
		resolveDuration: number
	) {
		return ServerPeripheralDeviceAPI.reportResolveDone(this, deviceId, deviceToken, timelineHash, resolveDuration)
	}

	// ------ Spreadsheet Gateway --------
	async requestUserAuthToken(deviceId: PeripheralDeviceId, deviceToken: string, authUrl: string) {
		return makePromise(() => ServerPeripheralDeviceAPI.requestUserAuthToken(this, deviceId, deviceToken, authUrl))
	}
	async storeAccessToken(deviceId: PeripheralDeviceId, deviceToken: string, authToken: any) {
		return makePromise(() => ServerPeripheralDeviceAPI.storeAccessToken(this, deviceId, deviceToken, authToken))
	}

	// ------ Ingest methods: ------------
	async dataPlaylistGet(deviceId: PeripheralDeviceId, deviceToken: string, playlistExternalId: string) {
		return RundownInput.dataPlaylistGet(this, deviceId, deviceToken, playlistExternalId)
	}
	async dataRundownList(deviceId: PeripheralDeviceId, deviceToken: string) {
		return RundownInput.dataRundownList(this, deviceId, deviceToken)
	}
	async dataRundownGet(deviceId: PeripheralDeviceId, deviceToken: string, rundownExternalId: string) {
		return RundownInput.dataRundownGet(this, deviceId, deviceToken, rundownExternalId)
	}
	async dataRundownDelete(deviceId: PeripheralDeviceId, deviceToken: string, rundownExternalId: string) {
		return RundownInput.dataRundownDelete(this, deviceId, deviceToken, rundownExternalId)
	}
	async dataRundownCreate(deviceId: PeripheralDeviceId, deviceToken: string, ingestRundown: IngestRundown) {
		return RundownInput.dataRundownCreate(this, deviceId, deviceToken, ingestRundown)
	}
	async dataRundownUpdate(deviceId: PeripheralDeviceId, deviceToken: string, ingestRundown: IngestRundown) {
		return RundownInput.dataRundownUpdate(this, deviceId, deviceToken, ingestRundown)
	}
	async dataRundownMetaDataUpdate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		ingestRundown: Omit<IngestRundown, 'segments'>
	) {
		return RundownInput.dataRundownMetaDataUpdate(this, deviceId, deviceToken, ingestRundown)
	}
	async dataSegmentGet(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string
	) {
		return RundownInput.dataSegmentGet(this, deviceId, deviceToken, rundownExternalId, segmentExternalId)
	}
	async dataSegmentDelete(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string
	) {
		return RundownInput.dataSegmentDelete(this, deviceId, deviceToken, rundownExternalId, segmentExternalId)
	}
	async dataSegmentCreate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		ingestSegment: IngestSegment
	) {
		return RundownInput.dataSegmentCreate(this, deviceId, deviceToken, rundownExternalId, ingestSegment)
	}
	async dataSegmentUpdate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		ingestSegment: IngestSegment
	) {
		return RundownInput.dataSegmentUpdate(this, deviceId, deviceToken, rundownExternalId, ingestSegment)
	}
	async dataSegmentRanksUpdate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		newRanks: { [segmentExternalId: string]: number }
	) {
		return RundownInput.dataSegmentRanksUpdate(this, deviceId, deviceToken, rundownExternalId, newRanks)
	}
	async dataPartDelete(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		partExternalId: string
	) {
		return RundownInput.dataPartDelete(
			this,
			deviceId,
			deviceToken,
			rundownExternalId,
			segmentExternalId,
			partExternalId
		)
	}
	async dataPartCreate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		ingestPart: IngestPart
	) {
		return RundownInput.dataPartCreate(
			this,
			deviceId,
			deviceToken,
			rundownExternalId,
			segmentExternalId,
			ingestPart
		)
	}
	async dataPartUpdate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		ingestPart: IngestPart
	) {
		return RundownInput.dataPartUpdate(
			this,
			deviceId,
			deviceToken,
			rundownExternalId,
			segmentExternalId,
			ingestPart
		)
	}

	// ------ MOS methods: --------
	async mosRoCreate(deviceId: PeripheralDeviceId, deviceToken: string, mosRunningOrder: MOS.IMOSRunningOrder) {
		return MosIntegration.mosRoCreate(this, deviceId, deviceToken, mosRunningOrder)
	}
	async mosRoReplace(deviceId: PeripheralDeviceId, deviceToken: string, mosRunningOrder: MOS.IMOSRunningOrder) {
		return MosIntegration.mosRoReplace(this, deviceId, deviceToken, mosRunningOrder)
	}
	async mosRoDelete(deviceId: PeripheralDeviceId, deviceToken: string, mosRunningOrderId: MOS.MosString128) {
		return MosIntegration.mosRoDelete(this, deviceId, deviceToken, mosRunningOrderId)
	}
	async mosRoMetadata(deviceId: PeripheralDeviceId, deviceToken: string, metadata: MOS.IMOSRunningOrderBase) {
		return MosIntegration.mosRoMetadata(this, deviceId, deviceToken, metadata)
	}
	async mosRoStatus(deviceId: PeripheralDeviceId, deviceToken: string, status: MOS.IMOSRunningOrderStatus) {
		return MosIntegration.mosRoStatus(this, deviceId, deviceToken, status)
	}
	async mosRoStoryStatus(deviceId: PeripheralDeviceId, deviceToken: string, status: MOS.IMOSStoryStatus) {
		return MosIntegration.mosRoStoryStatus(this, deviceId, deviceToken, status)
	}
	async mosRoItemStatus(deviceId: PeripheralDeviceId, deviceToken: string, status: MOS.IMOSItemStatus) {
		return MosIntegration.mosRoItemStatus(this, deviceId, deviceToken, status)
	}
	async mosRoStoryInsert(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSStoryAction,
		Stories: Array<MOS.IMOSROStory>
	) {
		return MosIntegration.mosRoStoryInsert(this, deviceId, deviceToken, Action, Stories)
	}
	async mosRoItemInsert(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSItemAction,
		Items: Array<MOS.IMOSItem>
	) {
		return MosIntegration.mosRoItemInsert(this, deviceId, deviceToken, Action, Items)
	}
	async mosRoStoryReplace(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSStoryAction,
		Stories: Array<MOS.IMOSROStory>
	) {
		return MosIntegration.mosRoStoryReplace(this, deviceId, deviceToken, Action, Stories)
	}
	async mosRoItemReplace(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSItemAction,
		Items: Array<MOS.IMOSItem>
	) {
		return MosIntegration.mosRoItemReplace(this, deviceId, deviceToken, Action, Items)
	}
	async mosRoStoryMove(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSStoryAction,
		Stories: Array<MOS.MosString128>
	) {
		return MosIntegration.mosRoStoryMove(this, deviceId, deviceToken, Action, Stories)
	}
	async mosRoItemMove(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSItemAction,
		Items: Array<MOS.MosString128>
	) {
		return MosIntegration.mosRoItemMove(this, deviceId, deviceToken, Action, Items)
	}
	async mosRoStoryDelete(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSROAction,
		Stories: Array<MOS.MosString128>
	) {
		return MosIntegration.mosRoStoryDelete(this, deviceId, deviceToken, Action, Stories)
	}
	async mosRoItemDelete(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSStoryAction,
		Items: Array<MOS.MosString128>
	) {
		return MosIntegration.mosRoItemDelete(this, deviceId, deviceToken, Action, Items)
	}
	async mosRoStorySwap(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSROAction,
		StoryID0: MOS.MosString128,
		StoryID1: MOS.MosString128
	) {
		return MosIntegration.mosRoStorySwap(this, deviceId, deviceToken, Action, StoryID0, StoryID1)
	}
	async mosRoItemSwap(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSStoryAction,
		ItemID0: MOS.MosString128,
		ItemID1: MOS.MosString128
	) {
		return MosIntegration.mosRoItemSwap(this, deviceId, deviceToken, Action, ItemID0, ItemID1)
	}
	async mosRoReadyToAir(deviceId: PeripheralDeviceId, deviceToken: string, Action: MOS.IMOSROReadyToAir) {
		return MosIntegration.mosRoReadyToAir(this, deviceId, deviceToken, Action)
	}
	async mosRoFullStory(deviceId: PeripheralDeviceId, deviceToken: string, story: MOS.IMOSROFullStory) {
		return MosIntegration.mosRoFullStory(this, deviceId, deviceToken, story)
	}
	// ------- Media Manager (Media Scanner)
	async getMediaObjectRevisions(deviceId: PeripheralDeviceId, deviceToken: string, collectionId: string) {
		return makePromise(() =>
			MediaScannerIntegration.getMediaObjectRevisions(this, deviceId, deviceToken, collectionId)
		)
	}
	async updateMediaObject(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		collectionId: string,
		id: string,
		doc: MediaObject | null
	) {
		return makePromise(() =>
			MediaScannerIntegration.updateMediaObject(this, deviceId, deviceToken, collectionId, id, doc)
		)
	}
	async clearMediaObjectCollection(deviceId: PeripheralDeviceId, deviceToken: string, collectionId: string) {
		return makePromise(() =>
			MediaScannerIntegration.clearMediaObjectCollection(deviceId, deviceToken, collectionId)
		)
	}
	// ------- Media Manager --------------
	async getMediaWorkFlowRevisions(deviceId: PeripheralDeviceId, deviceToken: string) {
		return makePromise(() => MediaManagerIntegration.getMediaWorkFlowRevisions(this, deviceId, deviceToken))
	}
	async getMediaWorkFlowStepRevisions(deviceId: PeripheralDeviceId, deviceToken: string) {
		return makePromise(() => MediaManagerIntegration.getMediaWorkFlowStepRevisions(this, deviceId, deviceToken))
	}
	async updateMediaWorkFlow(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		workFlowId: MediaWorkFlowId,
		obj: MediaWorkFlow | null
	) {
		return makePromise(() =>
			MediaManagerIntegration.updateMediaWorkFlow(this, deviceId, deviceToken, workFlowId, obj)
		)
	}
	async updateMediaWorkFlowStep(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		docId: MediaWorkFlowStepId,
		obj: MediaWorkFlowStep | null
	) {
		return makePromise(() =>
			MediaManagerIntegration.updateMediaWorkFlowStep(this, deviceId, deviceToken, docId, obj)
		)
	}
	async updateExpectedPackageWorkStatuses(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		changes: (
			| {
					id: ExpectedPackageWorkStatusId
					type: 'delete'
			  }
			| {
					id: ExpectedPackageWorkStatusId
					type: 'insert'
					status: ExpectedPackageStatusAPI.WorkStatus
			  }
			| {
					id: ExpectedPackageWorkStatusId
					type: 'update'
					status: Partial<ExpectedPackageStatusAPI.WorkStatus>
			  }
		)[]
	): Promise<void> {
		await PackageManagerIntegration.updateExpectedPackageWorkStatuses(this, deviceId, deviceToken, changes)
	}
	async removeAllExpectedPackageWorkStatusOfDevice(deviceId: PeripheralDeviceId, deviceToken: string) {
		await PackageManagerIntegration.removeAllExpectedPackageWorkStatusOfDevice(this, deviceId, deviceToken)
	}
	async updatePackageContainerPackageStatuses(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		changes: (
			| {
					containerId: string
					packageId: string
					type: 'delete'
			  }
			| {
					containerId: string
					packageId: string
					type: 'update'
					status: ExpectedPackageStatusAPI.PackageContainerPackageStatus
			  }
		)[]
	): Promise<void> {
		await PackageManagerIntegration.updatePackageContainerPackageStatuses(this, deviceId, deviceToken, changes)
	}
	async removeAllPackageContainerPackageStatusesOfDevice(deviceId: PeripheralDeviceId, deviceToken: string) {
		await PackageManagerIntegration.removeAllPackageContainerPackageStatusesOfDevice(this, deviceId, deviceToken)
	}
	async updatePackageContainerStatuses(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		changes: (
			| {
					containerId: string
					type: 'delete'
			  }
			| {
					containerId: string
					type: 'update'
					status: ExpectedPackageStatusAPI.PackageContainerStatus
			  }
		)[]
	): Promise<void> {
		await PackageManagerIntegration.updatePackageContainerStatuses(this, deviceId, deviceToken, changes)
	}
	async removeAllPackageContainerStatusesOfDevice(deviceId: PeripheralDeviceId, deviceToken: string) {
		await PackageManagerIntegration.removeAllPackageContainerStatusesOfDevice(this, deviceId, deviceToken)
	}

	async fetchPackageInfoMetadata(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		type: string,
		packageIds: ExpectedPackageId[]
	) {
		return PackageManagerIntegration.fetchPackageInfoMetadata(this, deviceId, deviceToken, type, packageIds)
	}
	async updatePackageInfo(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		type: PackageInfo.Type, // string
		packageId: ExpectedPackageId,
		expectedContentVersionHash: string,
		actualContentVersionHash: string,
		payload: any
	) {
		await PackageManagerIntegration.updatePackageInfo(
			this,
			deviceId,
			deviceToken,
			type,
			packageId,
			expectedContentVersionHash,
			actualContentVersionHash,
			payload
		)
	}
	async removePackageInfo(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		type: string,
		packageId: ExpectedPackageId
	) {
		await PackageManagerIntegration.removePackageInfo(this, deviceId, deviceToken, type, packageId)
	}
}
registerClassToMeteorMethods(PeripheralDeviceAPIMethods, ServerPeripheralDeviceAPIClass, false)
