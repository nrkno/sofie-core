import { check } from '../../lib/check'
import { literal, getCurrentTime, Time, getRandomId, stringifyError } from '../../lib/lib'
import { logger } from '../logging'
import { ClientAPI, NewClientAPI, ClientAPIMethods } from '../../lib/api/client'
import { UserActionsLog, UserActionsLogItem } from '../../lib/collections/UserActionsLog'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { registerClassToMeteorMethods } from '../methods'
import { MethodContext, MethodContextAPI } from '../../lib/api/methods'
import { Settings } from '../../lib/Settings'
import { resolveCredentials } from '../security/lib/credentials'
import { isInTestWrite, triggerWriteAccessBecauseNoCheckNecessary } from '../security/lib/securityVerify'
import { PeripheralDeviceContentWriteAccess } from '../security/peripheralDevice'
import { endTrace, sendTrace, startTrace } from './integration/influx'
import { interpollateTranslation, translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { StudioJobFunc } from '@sofie-automation/corelib/dist/worker/studio'
import { QueueStudioJob } from '../worker/worker'
import { profiler } from './profiler'
import {
	OrganizationId,
	PeripheralDeviceId,
	RundownId,
	RundownPlaylistId,
	StudioId,
	UserActionsLogItemId,
	UserId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	checkAccessToPlaylist,
	checkAccessToRundown,
	VerifiedRundownContentAccess,
	VerifiedRundownPlaylistContentAccess,
} from './lib'
import { BasicAccessContext } from '../security/organization'
import { NoticeLevel } from '../../client/lib/notifications/notifications'

function rewrapError(methodName: string, e: any): ClientAPI.ClientResponseError {
	let userError: UserError
	if (UserError.isUserError(e)) {
		userError = e
	} else {
		// Rewrap errors as a UserError
		const err = e instanceof Error ? e : new Error(stringifyError(e))
		userError = UserError.from(err, UserErrorMessage.InternalError)
	}

	logger.info(`UserAction "${methodName}" failed: ${stringifyError(userError)}`)

	// Forward the error to the caller
	return ClientAPI.responseError(userError)
}

export namespace ServerClientAPI {
	/**
	 * Run a UserAction for a Playlist with a job sent to the Studio WorkerThread
	 */
	export async function runUserActionInLogForPlaylistOnWorker<T extends keyof StudioJobFunc>(
		context: MethodContext,
		userEvent: string,
		eventTime: Time,
		playlistId: RundownPlaylistId,
		checkArgs: () => void,
		jobName: T,
		jobArguments: Parameters<StudioJobFunc[T]>[0]
	): Promise<ClientAPI.ClientResponse<ReturnType<StudioJobFunc[T]>>> {
		return runUserActionInLog(
			context,
			userEvent,
			eventTime,
			`worker.${jobName}`,
			[jobArguments],
			async (_credentials, userActionMetadata) => {
				checkArgs()

				const access = await checkAccessToPlaylist(context, playlistId)
				return runStudioJob(access.playlist.studioId, jobName, jobArguments, userActionMetadata)
			}
		)
	}

	/**
	 * Run a UserAction for a Rundown with a job sent to the Studio WorkerThread
	 */
	export async function runUserActionInLogForRundownOnWorker<T extends keyof StudioJobFunc>(
		context: MethodContext,
		userEvent: string,
		eventTime: Time,
		rundownId: RundownId,
		checkArgs: () => void,
		jobName: T,
		jobArguments: Parameters<StudioJobFunc[T]>[0]
	): Promise<ClientAPI.ClientResponse<ReturnType<StudioJobFunc[T]>>> {
		return runUserActionInLog(
			context,
			userEvent,
			eventTime,
			`worker.${jobName}`,
			[jobArguments],
			async (_credentials, userActionMetadata) => {
				checkArgs()

				const access = await checkAccessToRundown(context, rundownId)
				return runStudioJob(access.rundown.studioId, jobName, jobArguments, userActionMetadata)
			}
		)
	}

	/**
	 * Run a UserAction for a Playlist with a custom executor
	 */
	export async function runUserActionInLogForPlaylist<T>(
		context: MethodContext,
		userEvent: string,
		eventTime: Time,
		playlistId: RundownPlaylistId,
		checkArgs: () => void,
		methodName: string,
		args: any[],
		fcn: (access: VerifiedRundownPlaylistContentAccess) => Promise<T>
	): Promise<ClientAPI.ClientResponse<T>> {
		return runUserActionInLog(context, userEvent, eventTime, methodName, args, async () => {
			checkArgs()

			const access = await checkAccessToPlaylist(context, playlistId)
			return fcn(access)
		})
	}

	/**
	 * Run a UserAction for a Rundown with a custom executor
	 */
	export async function runUserActionInLogForRundown<T>(
		context: MethodContext,
		userEvent: string,
		eventTime: Time,
		rundownId: RundownId,
		checkArgs: () => void,
		methodName: string,
		args: any[],
		fcn: (access: VerifiedRundownContentAccess) => Promise<T>
	): Promise<ClientAPI.ClientResponse<T>> {
		return runUserActionInLog(context, userEvent, eventTime, methodName, args, async () => {
			checkArgs()

			const access = await checkAccessToRundown(context, rundownId)
			return fcn(access)
		})
	}

	async function runStudioJob<T extends keyof StudioJobFunc>(
		studioId: StudioId,
		jobName: T,
		jobArguments: Parameters<StudioJobFunc[T]>[0],
		userActionMetadata: UserActionMetadata
	): Promise<ReturnType<StudioJobFunc[T]>> {
		const queuedJob = await QueueStudioJob(jobName, studioId, jobArguments)

		try {
			const span = profiler.startSpan('queued-job')
			const res = await queuedJob.complete
			span?.end()

			return res
		} finally {
			try {
				const timings = await queuedJob.getTimings
				// If the worker reported timings, use them
				if (timings.finishedTime && timings.startedTime) {
					userActionMetadata.workerDuration = timings.finishedTime - timings.startedTime
				}
			} catch (_e) {
				// Failed to get the timings, so ignore it
			}
		}
	}

	/** Metadata to track as the output of a UserAction */
	export interface UserActionMetadata {
		/** How long did the worker take to execute this job? */
		workerDuration?: number
	}

	/**
	 * Run a UserAction in the UserActionsLog
	 */
	export async function runUserActionInLog<TRes>(
		context: MethodContext,
		userEvent: string,
		eventTime: Time,
		methodName: string,
		methodArgs: unknown[],
		fcn: (credentials: BasicAccessContext, userActionMetadata: UserActionMetadata) => Promise<TRes>
	): Promise<ClientAPI.ClientResponse<TRes>> {
		// If we are in the test write auth check mode, then bypass all special logic to ensure errors dont get mangled
		if (isInTestWrite()) {
			const result = await fcn({ organizationId: null, userId: null }, {})
			return ClientAPI.responseSuccess(result)
		}

		// Execute normally
		const startTime = Date.now()
		const transaction = profiler.startTransaction(methodName, 'userAction')
		const influxTrace = startTrace('userFunction:' + methodName)

		try {
			if (!context.connection) {
				// Called internally from server-side.
				// Just run and return right away:
				try {
					const result = await fcn({ organizationId: null, userId: null }, {})

					return ClientAPI.responseSuccess(result)
				} catch (e) {
					return rewrapError(methodName, e)
				}
			} else {
				const credentials = await getLoggedInCredentials(context)

				// Start the db entry, but don't wait for it
				const actionId: UserActionsLogItemId = getRandomId()
				const pInitialInsert = UserActionsLog.insertAsync(
					literal<UserActionsLogItem>({
						_id: actionId,
						clientAddress: context.connection.clientAddress,
						organizationId: credentials.organizationId,
						userId: credentials.userId,
						context: userEvent,
						method: methodName,
						args: JSON.stringify(methodArgs),
						timestamp: getCurrentTime(),
						clientTime: eventTime,
					})
				).catch((e) => {
					// If this fails make sure it is handled
					logger.warn(`Failed to insert into UserActionsLog: ${stringifyError(e)}`)
				})

				const userActionMetadata: UserActionMetadata = {}
				try {
					const result = await fcn(credentials, userActionMetadata)

					const completeTime = Date.now()
					await UserActionsLog.updateAsync(actionId, {
						$set: {
							success: true,
							doneTime: completeTime,
							executionTime: completeTime - startTime,
							workerTime: userActionMetadata.workerDuration,
						},
					})

					return ClientAPI.responseSuccess(result)
				} catch (e) {
					const errorTime = Date.now()

					const wrappedError = rewrapError(methodName, e)
					const wrappedErrorStr = `ClientResponseError: ${translateMessage(
						wrappedError.error.message,
						interpollateTranslation
					)}`

					// Execute, but don't wait for it
					pInitialInsert
						.then(async () =>
							UserActionsLog.updateAsync(actionId, {
								$set: {
									success: false,
									doneTime: errorTime,
									executionTime: errorTime - startTime,
									workerTime: userActionMetadata.workerDuration,
									errorMessage: wrappedErrorStr,
								},
							})
						)
						.catch((err) => {
							// If this fails make sure it is handled
							logger.warn(`Failed to update UserActionsLog: ${stringifyError(err)}`)
						})

					return wrappedError
				}
			}
		} catch (e) {
			// Make sure the transactions are completed even when we error
			const errStr = stringifyError(e)

			if (transaction) {
				transaction.addLabels({ error: errStr })
				transaction.end()
			}

			if (!influxTrace.tags) influxTrace.tags = {}
			influxTrace.tags['error'] = errStr
			sendTrace(endTrace(influxTrace))

			return rewrapError(methodName, e)
		}
	}

	export async function callPeripheralDeviceFunctionOrAction(
		methodContext: MethodContext,
		context: string,
		deviceId: PeripheralDeviceId,
		timeoutTime: number | undefined,
		action: {
			functionName?: string
			args?: Array<any>
			actionId?: string
			payload?: Record<string, any>
		}
	): Promise<any> {
		check(deviceId, String)
		check(context, String)

		if (!action.functionName && !action.actionId) {
			throw new Error('Either functionName or actionId should be specified')
		}

		const actionId: UserActionsLogItemId = getRandomId()
		const startTime = Date.now()

		if (!methodContext.connection) {
			// In this case, it was called internally from server-side.
			// Just run and return right away:
			triggerWriteAccessBecauseNoCheckNecessary()
			return PeripheralDeviceAPI.executeFunctionWithCustomTimeout(deviceId, timeoutTime, action).catch(
				async (e) => {
					const errMsg = e.message || e.reason || (e.toString ? e.toString() : null)
					logger.error(errMsg)
					// allow the exception to be handled by the Client code
					return Promise.reject(e)
				}
			)
		}

		const access = await PeripheralDeviceContentWriteAccess.executeFunction(methodContext, deviceId)

		await UserActionsLog.insertAsync(
			literal<UserActionsLogItem>({
				_id: actionId,
				clientAddress: methodContext.connection ? methodContext.connection.clientAddress : '',
				organizationId: access.organizationId,
				userId: access.userId,
				context: context,
				method: `${deviceId}: ${action.functionName || action.actionId}`,
				args: JSON.stringify(action.args || action.payload),
				timestamp: getCurrentTime(),
			})
		)

		return PeripheralDeviceAPI.executeFunctionWithCustomTimeout(deviceId, timeoutTime, action)
			.then(async (result) => {
				await UserActionsLog.updateAsync(actionId, {
					$set: {
						success: true,
						doneTime: getCurrentTime(),
						executionTime: Date.now() - startTime,
					},
				})

				return result
			})
			.catch(async (err) => {
				const errMsg = err.message || err.reason || (err.toString ? err.toString() : null)
				logger.error(errMsg)
				await UserActionsLog.updateAsync(actionId, {
					$set: {
						success: false,
						doneTime: getCurrentTime(),
						executionTime: Date.now() - startTime,
						errorMessage: errMsg,
					},
				})

				// allow the exception to be handled by the Client code
				return Promise.reject(err)
			})
	}
	async function getLoggedInCredentials(methodContext: MethodContext): Promise<BasicAccessContext> {
		let userId: UserId | null = null
		let organizationId: OrganizationId | null = null
		if (Settings.enableUserAccounts) {
			const cred = await resolveCredentials({ userId: methodContext.userId })
			if (cred.user) userId = cred.user._id
			organizationId = cred.organizationId
		}
		return { userId, organizationId }
	}
}

class ServerClientAPIClass extends MethodContextAPI implements NewClientAPI {
	async clientErrorReport(timestamp: Time, errorObject: any, errorString: string, location: string) {
		check(timestamp, Number)
		triggerWriteAccessBecauseNoCheckNecessary() // TODO: discuss if is this ok?
		logger.error(
			`Uncaught error happened in GUI\n  in "${location}"\n  on "${
				this.connection ? this.connection.clientAddress : 'N/A'
			}"\n  at ${new Date(timestamp).toISOString()}:\n"${errorString}"\n${JSON.stringify(errorObject)}`
		)
	}
	async clientLogNotification(timestamp: Time, from: string, severity: NoticeLevel, message: string, source?: any) {
		check(timestamp, Number)
		triggerWriteAccessBecauseNoCheckNecessary() // TODO: discuss if is this ok?
		const address = this.connection ? this.connection.clientAddress : 'N/A'
		logger.debug(`Notification reported from "${from}": Severity ${severity}: ${message} (${source})`, {
			time: timestamp,
			from,
			severity,
			origMessage: message,
			source,
			address,
		})
	}
	async callPeripheralDeviceFunction(
		context: string,
		deviceId: PeripheralDeviceId,
		timeoutTime: number | undefined,
		functionName: string,
		...args: any[]
	) {
		return ServerClientAPI.callPeripheralDeviceFunctionOrAction(this, context, deviceId, timeoutTime, {
			functionName,
			args,
		})
	}
	async callPeripheralDeviceAction(
		context: string,
		deviceId: PeripheralDeviceId,
		timeoutTime: number | undefined,
		actionId: string,
		payload?: Record<string, any>
	) {
		return ServerClientAPI.callPeripheralDeviceFunctionOrAction(this, context, deviceId, timeoutTime, {
			actionId,
			payload,
		})
	}
}
registerClassToMeteorMethods(ClientAPIMethods, ServerClientAPIClass, false)
