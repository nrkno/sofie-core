import {
	Conductor,
	DeviceType,
	ConductorOptions,
	Device,
	TimelineTriggerTimeResult,
	DeviceOptionsAny,
	Mappings,
	DeviceContainer,
	Timeline as TimelineTypes,
	TSRTimelineObj,
	TSRTimeline,
	TSRTimelineObjBase,
	CommandReport,
	DeviceOptionsAtem,
	AtemMediaPoolAsset,
	MediaObject,
	ExpectedPlayoutItem,
	ExpectedPlayoutItemContent,
	SlowSentCommandInfo,
	SlowFulfilledCommandInfo,
	DeviceStatus,
	StatusCode,
} from 'timeline-state-resolver'
import { CoreHandler, CoreTSRDeviceHandler } from './coreHandler'
import clone = require('fast-clone')
import * as crypto from 'crypto'
import * as cp from 'child_process'

import * as _ from 'underscore'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { TimelineObjectCoreExt } from '@sofie-automation/blueprints-integration'
import { Logger } from 'winston'
import { disableAtemUpload } from './config'
import Debug from 'debug'
import { FinishedTrace, sendTrace } from './influxdb'
import { PeripheralDeviceAPIMethods } from '@sofie-automation/shared-lib/dist/peripheralDevice/methodsAPI'
import {
	PartPlaybackCallbackData,
	PiecePlaybackCallbackData,
	PlayoutChangedResults,
	PlayoutChangedType,
	StatusObject,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { assertNever } from '@sofie-automation/shared-lib/dist/lib/lib'

const debug = Debug('playout-gateway')

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TSRConfig {}
export interface TSRSettings {
	// Runtime settings from Core
	devices: {
		[deviceId: string]: DeviceOptionsAny
	}
	mappings: Mappings
	errorReporting?: boolean
	multiThreading?: boolean
	multiThreadedResolver?: boolean
	useCacheWhenResolving?: boolean
}
export interface TSRDevice {
	coreConnection: CoreConnection
	device: Device<DeviceOptionsAny>
}

// ----------------------------------------------------------------------------
// interface copied from Core lib/collections/Timeline.ts

export type TimelineEnableExt = TimelineTypes.TimelineEnable & { setFromNow?: boolean }
export interface TimelineObjGeneric extends TimelineObjectCoreExt {
	/** Unique within a timeline (ie within a studio) */
	id: string
	/** Set when the id of the object is prefixed */
	originalId?: string

	objectType: TimelineObjType

	enable: TimelineEnableExt | TimelineEnableExt[]

	/** The id of the group object this object is in  */
	inGroup?: string
}
export enum TimelineObjType {
	/** Objects played in a rundown */
	RUNDOWN = 'rundown',
	/** Objects controlling recording */
	RECORDING = 'record',
	/** Objects controlling manual playback */
	MANUAL = 'manual',
	/** "Magic object", used to calculate a hash of the timeline */
	STAT = 'stat',
}

/** This is the data-object published from Core */
export interface RoutedTimeline {
	_id: string
	/** Hash of the studio mappings */
	mappingsHash: string

	/** Hash of the Timeline */
	timelineHash: string

	/** serialized JSON Array containing all timeline-objects */
	timelineBlob: string
	generated: number

	// this is the old way of storing the timeline, kept for backwards-compatibility
	timeline?: TimelineObjGeneric[]
}
export interface RoutedMappings {
	_id: string
	mappingsHash: string | undefined
	mappings: Mappings
}
// ----------------------------------------------------------------------------

export interface TimelineContentObjectTmp extends TSRTimelineObjBase {
	inGroup?: string
}
/** Max time for initializing devices */
const INIT_TIMEOUT = 10000

enum DeviceAction {
	ADD = 'add',
	READD = 'readd',
	REMOVE = 'remove',
}

type DeviceActionResult = {
	success: boolean
	deviceId: string
	action: DeviceAction
}

type UpdateDeviceOperationsResult =
	| {
			success: true
			results: DeviceActionResult[]
	  }
	| {
			success: false
			reason: 'timeout' | 'error'
			details: string[]
	  }

/**
 * Represents a connection between Gateway and TSR
 */
export class TSRHandler {
	logger: Logger
	tsr!: Conductor
	// private _config: TSRConfig
	private _coreHandler!: CoreHandler
	private _triggerupdateExpectedPlayoutItemsTimeout: any = null
	private _coreTsrHandlers: { [deviceId: string]: CoreTSRDeviceHandler } = {}
	private _observers: Array<any> = []
	private _cachedStudioId = ''

	private _initialized = false
	private _multiThreaded: boolean | null = null
	private _reportAllCommands: boolean | null = null
	private _errorReporting: boolean | null = null

	private _updateDevicesIsRunning = false
	private _lastReportedObjHashes: string[] = []
	private _triggerUpdateDevicesCheckAgain = false
	private _triggerUpdateDevicesTimeout: NodeJS.Timeout | undefined

	constructor(logger: Logger) {
		this.logger = logger
	}

	public async init(_config: TSRConfig, coreHandler: CoreHandler): Promise<void> {
		// this._config = config
		this._coreHandler = coreHandler

		this._coreHandler.setTSR(this)

		this.logger.info('TSRHandler init')

		const peripheralDevice = await coreHandler.core.getPeripheralDevice()
		const settings: TSRSettings = peripheralDevice.settings || {}

		this.logger.info('Devices', settings.devices)
		const c: ConductorOptions = {
			getCurrentTime: (): number => {
				return this._coreHandler.core.getCurrentTime()
			},
			multiThreadedResolver: settings.multiThreadedResolver === true,
			useCacheWhenResolving: settings.useCacheWhenResolving === true,
			proActiveResolve: true,
		}
		this.tsr = new Conductor(c)
		this._triggerupdateTimelineAndMappings('TSRHandler.init()')

		coreHandler.onConnected(() => {
			this.setupObservers()
			this.resendStatuses()
		})
		this.setupObservers()

		this.tsr.on('error', (e, ...args) => {
			// CasparCG play and load 404 errors should be warnings:
			const msg: string = e + ''
			const cmdReply = args[0]

			if (
				msg.match(/casparcg/i) &&
				(msg.match(/PlayCommand/i) || msg.match(/LoadbgCommand/i)) &&
				cmdReply &&
				_.isObject(cmdReply) &&
				cmdReply.response &&
				cmdReply.response.code === 404
			) {
				this.logger.warn(`TSR: ${e.toString()}`, args)
			} else {
				this.logger.error(`TSR: ${e.toString()}`, args)
			}
		})
		this.tsr.on('info', (msg, ...args) => {
			this.logger.info(`TSR: ${msg + ''}`, args)
		})
		this.tsr.on('warning', (msg, ...args) => {
			this.logger.warn(`TSR: ${msg + ''}`, args)
		})
		this.tsr.on('debug', (...args: any[]) => {
			if (!this._coreHandler.logDebug) {
				return
			}
			const data = args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : arg))
			this.logger.debug(`TSR debug message (${args.length})`, { data })
		})

		this.tsr.on('setTimelineTriggerTime', (r: TimelineTriggerTimeResult) => {
			this._coreHandler.core
				.callMethod(PeripheralDeviceAPIMethods.timelineTriggerTime, [r])
				.catch((error) => this.logger.error('Error in setTimelineTriggerTime', { data: error }))
		})

		this.tsr.on('timelineCallback', (time, objId, callbackName, data) => {
			this.handleTSRTimelineCallback(time, objId, callbackName, data)
		})
		this.tsr.on('resolveDone', (timelineHash: string, resolveDuration: number) => {
			// Make sure we only report back once, per update timeline
			if (this._lastReportedObjHashes.includes(timelineHash)) return

			this._lastReportedObjHashes.unshift(timelineHash)
			if (this._lastReportedObjHashes.length > 10) {
				this._lastReportedObjHashes.length = 10
			}

			this._coreHandler.core
				.callMethod('peripheralDevice.reportResolveDone', [timelineHash, resolveDuration])
				.catch((error) => this.logger.error('Error in reportResolveDone', { data: error }))

			sendTrace({
				measurement: 'playout-gateway.tlResolveDone',
				tags: {},
				start: Date.now() - resolveDuration,
				duration: resolveDuration,
				ended: Date.now(),
			})
		})
		this.tsr.on('timeTrace', (trace: FinishedTrace) => sendTrace(trace))

		this.logger.debug('tsr init')
		await this.tsr.init()

		this._initialized = true
		this._triggerupdateTimelineAndMappings('TSRHandler.init(), later')
		this.onSettingsChanged()
		this._triggerUpdateDevices()
		this.logger.debug('tsr init done')
	}
	private setupObservers(): void {
		if (this._observers.length) {
			this.logger.debug('Clearing observers..')
			this._observers.forEach((obs) => {
				obs.stop()
			})
			this._observers = []
		}
		this.logger.debug('Renewing observers')

		const timelineObserver = this._coreHandler.core.observe('studioTimeline')
		timelineObserver.added = () => {
			this._triggerupdateTimelineAndMappings('studioTimeline.added', true)
		}
		timelineObserver.changed = () => {
			this._triggerupdateTimelineAndMappings('studioTimeline.changed', true)
		}
		timelineObserver.removed = () => {
			this._triggerupdateTimelineAndMappings('studioTimeline.removed', true)
		}
		this._observers.push(timelineObserver)

		const mappingsObserver = this._coreHandler.core.observe('studioMappings')
		mappingsObserver.added = () => {
			this._triggerupdateTimelineAndMappings('studioMappings.added')
		}
		mappingsObserver.changed = () => {
			this._triggerupdateTimelineAndMappings('studioMappings.changed')
		}
		mappingsObserver.removed = () => {
			this._triggerupdateTimelineAndMappings('studioMappings.removed')
		}
		this._observers.push(mappingsObserver)

		const deviceObserver = this._coreHandler.core.observe('peripheralDevices')
		deviceObserver.added = () => {
			debug('triggerUpdateDevices from deviceObserver added')
			this._triggerUpdateDevices()
		}
		deviceObserver.changed = (_id, _oldFields, _clearedFields, newFields) => {
			// Only react to changes in the .settings property:
			if (newFields['settings'] !== undefined) {
				debug('triggerUpdateDevices from deviceObserver changed')
				this._triggerUpdateDevices()
			}
		}
		deviceObserver.removed = () => {
			debug('triggerUpdateDevices from deviceObserver removed')
			this._triggerUpdateDevices()
		}
		this._observers.push(deviceObserver)

		const expectedPlayoutItemsObserver = this._coreHandler.core.observe('expectedPlayoutItems')
		expectedPlayoutItemsObserver.added = () => {
			this._triggerupdateExpectedPlayoutItems()
		}
		expectedPlayoutItemsObserver.changed = () => {
			this._triggerupdateExpectedPlayoutItems()
		}
		expectedPlayoutItemsObserver.removed = () => {
			this._triggerupdateExpectedPlayoutItems()
		}
		this._observers.push(expectedPlayoutItemsObserver)
	}
	private resendStatuses(): void {
		_.each(this._coreTsrHandlers, (tsrHandler) => {
			tsrHandler.sendStatus()
		})
	}
	async destroy(): Promise<void> {
		return this.tsr.destroy()
	}
	getTimeline(): RoutedTimeline | undefined {
		const studioId = this._getStudioId()
		if (!studioId) {
			this.logger.warn('no studioId')
			return undefined
		}

		const timeline = this._coreHandler.core.getCollection('studioTimeline').findOne(studioId)

		return timeline as any
	}
	getMappings(): RoutedMappings | undefined {
		const studioId = this._getStudioId()
		if (!studioId) {
			// this.logger.warn('no studioId')
			return undefined
		}
		// Note: The studioMappings virtual collection contains a single object that contains all mappings
		const mappingsObject = this._coreHandler.core.getCollection('studioMappings').findOne(studioId)

		return mappingsObject as any
	}
	onSettingsChanged(): void {
		if (!this._initialized) return

		if (this.tsr.logDebug !== this._coreHandler.logDebug) {
			this.logger.info(`Log settings: ${this._coreHandler.logDebug}`)
			this.tsr.logDebug = this._coreHandler.logDebug
		}

		if (this._errorReporting !== this._coreHandler.errorReporting) {
			this._errorReporting = this._coreHandler.errorReporting

			this.logger.info('ErrorReporting: ' + this._multiThreaded)
		}
		if (this.tsr.estimateResolveTimeMultiplier !== this._coreHandler.estimateResolveTimeMultiplier) {
			this.tsr.estimateResolveTimeMultiplier = this._coreHandler.estimateResolveTimeMultiplier
			this.logger.info('estimateResolveTimeMultiplier: ' + this._coreHandler.estimateResolveTimeMultiplier)
		}
		if (this._multiThreaded !== this._coreHandler.multithreading) {
			this._multiThreaded = this._coreHandler.multithreading

			this.logger.info('Multithreading: ' + this._multiThreaded)

			debug('triggerUpdateDevices from onSettingsChanged')
			this._triggerUpdateDevices()
		}
		if (this._reportAllCommands !== this._coreHandler.reportAllCommands) {
			this._reportAllCommands = this._coreHandler.reportAllCommands

			this.logger.info('ReportAllCommands: ' + this._reportAllCommands)

			debug('triggerUpdateDevices from onSettingsChanged')
			this._triggerUpdateDevices()
		}
	}
	private _triggerupdateTimelineAndMappings(context: string, fromTlChange?: boolean) {
		if (!this._initialized) return

		this._updateTimelineAndMappings(context, fromTlChange)
	}
	private _updateTimelineAndMappings(context: string, fromTlChange?: boolean) {
		const timeline = this.getTimeline()
		const mappingsObject = this.getMappings()

		if (!timeline) {
			this.logger.debug(`Cancel resolving: No timeline`)
			return
		}
		if (!mappingsObject) {
			this.logger.debug(`Cancel resolving: No mappings`)
			return
		}
		// Compare mappingsHash to ensure that the timeline we've received is in sync with the mappings:
		if (timeline.mappingsHash !== mappingsObject.mappingsHash) {
			this.logger.info(
				`Cancel resolving: mappingsHash differ: "${timeline.mappingsHash}" vs "${mappingsObject.mappingsHash}"`
			)
			return
		}

		this.logger.debug(
			`Trigger new resolving (${context}, hash: ${timeline.timelineHash}, gen: ${new Date(
				timeline.generated
			).toISOString()})`
		)
		if (fromTlChange) {
			sendTrace({
				measurement: 'playout-gateway:timelineReceived',
				start: timeline.generated,
				tags: {},
				ended: Date.now(),
				duration: Date.now() - timeline.generated,
			})
		}

		const transformedTimeline = timeline.timelineBlob
			? this._transformTimeline(JSON.parse(timeline.timelineBlob) as Array<TimelineObjGeneric>)
			: timeline.timeline
			? this._transformTimeline(clone(timeline.timeline))
			: []
		this.tsr.timelineHash = timeline.timelineHash
		this.tsr.setTimelineAndMappings(transformedTimeline, mappingsObject.mappings)
	}
	private _getPeripheralDevice() {
		const peripheralDevices = this._coreHandler.core.getCollection('peripheralDevices')
		return peripheralDevices.findOne(this._coreHandler.core.deviceId)
	}
	private _getStudio(): any | null {
		const peripheralDevice = this._getPeripheralDevice()
		if (!peripheralDevice) {
			return null
		}
		const studios = this._coreHandler.core.getCollection('studios')
		return studios.findOne(peripheralDevice.studioId)
	}
	private _getStudioId(): string | null {
		if (this._cachedStudioId) return this._cachedStudioId

		const studio = this._getStudio()
		if (studio) {
			this._cachedStudioId = studio._id
			return studio._id
		}
		return null
	}
	private _triggerUpdateDevices() {
		if (!this._initialized) return

		if (this._triggerUpdateDevicesTimeout) {
			clearTimeout(this._triggerUpdateDevicesTimeout)
		}
		this._triggerUpdateDevicesTimeout = undefined

		if (this._updateDevicesIsRunning) {
			debug('triggerUpdateDevices already running, cue a check again later')
			this._triggerUpdateDevicesCheckAgain = true
			return
		}
		this._updateDevicesIsRunning = true
		debug('triggerUpdateDevices now')

		// Defer:
		setTimeout(() => {
			this._updateDevices()
				.then(
					() =>
						this._triggerUpdateDevicesCheckAgain &&
						debug('triggerUpdateDevices from updateDevices promise resolved')
				)
				.catch(
					() =>
						this._triggerUpdateDevicesCheckAgain &&
						debug('triggerUpdateDevices from updateDevices promise rejected')
				)
				.finally(() => {
					this._updateDevicesIsRunning = false
					if (!this._triggerUpdateDevicesCheckAgain) {
						return
					}
					if (this._triggerUpdateDevicesTimeout) {
						clearTimeout(this._triggerUpdateDevicesTimeout)
					}
					this._triggerUpdateDevicesTimeout = setTimeout(() => this._triggerUpdateDevices(), 1000)
					this._triggerUpdateDevicesCheckAgain = false
				})
		}, 10)
	}
	private async _updateDevices(): Promise<void> {
		this.logger.debug('updateDevices start')

		const peripheralDevices = this._coreHandler.core.getCollection('peripheralDevices')
		const peripheralDevice = peripheralDevices.findOne(this._coreHandler.core.deviceId)

		const ps: Promise<DeviceActionResult>[] = []
		const promiseOperations: { [id: string]: { deviceId: string; operation: DeviceAction } } = {}
		const keepTrack = async <T>(p: Promise<T>, deviceId: string, operation: DeviceAction) => {
			const name = `${operation}_${deviceId}`
			promiseOperations[name] = {
				deviceId,
				operation,
			}
			return p.then((result) => {
				delete promiseOperations[name]
				return result
			})
		}
		const deviceOptions = new Map<string, DeviceOptionsAny>()

		if (peripheralDevice) {
			const settings: TSRSettings = peripheralDevice.settings || {}

			for (const [deviceId, device] of Object.entries(settings.devices)) {
				if (!device.disable) {
					deviceOptions.set(deviceId, device)
				}
			}

			for (const [deviceId, orgDeviceOptions] of deviceOptions.entries()) {
				const oldDevice: DeviceContainer<DeviceOptionsAny> | undefined = this.tsr.getDevice(deviceId, true)

				const deviceOptions = _.extend(
					{
						// Defaults:
						limitSlowSentCommand: 40,
						limitSlowFulfilledCommand: 100,
						options: {},
					},
					orgDeviceOptions
				)

				if (this._multiThreaded !== null && deviceOptions.isMultiThreaded === undefined) {
					deviceOptions.isMultiThreaded = this._multiThreaded
				}
				if (this._reportAllCommands !== null && deviceOptions.reportAllCommands === undefined) {
					deviceOptions.reportAllCommands = this._reportAllCommands
				}

				if (!oldDevice) {
					if (deviceOptions.options) {
						this.logger.info('Initializing device: ' + deviceId)
						this.logger.info('new', deviceOptions)
						ps.push(keepTrack(this._addDevice(deviceId, deviceOptions), deviceId, DeviceAction.ADD))
					}
				} else {
					if (deviceOptions.options) {
						let anyChanged = false

						if (
							// Changing the debug flag shouldn't restart the device:
							!_.isEqual(_.omit(oldDevice.deviceOptions, 'debug'), _.omit(deviceOptions, 'debug'))
						) {
							anyChanged = true
						}

						if (anyChanged) {
							deviceOptions.debug = this.getDeviceDebug(orgDeviceOptions)

							this.logger.info('Re-initializing device: ' + deviceId)
							this.logger.info('old', oldDevice.deviceOptions)
							this.logger.info('new', deviceOptions)
							ps.push(
								keepTrack(this._removeDevice(deviceId), deviceId, DeviceAction.REMOVE).then(async () =>
									keepTrack(this._addDevice(deviceId, deviceOptions), deviceId, DeviceAction.READD)
								)
							)
						}
					}
				}
			}

			for (const oldDevice of this.tsr.getDevices()) {
				const deviceId = oldDevice.deviceId
				if (!deviceOptions.has(deviceId)) {
					this.logger.info('Un-initializing device: ' + deviceId)
					ps.push(keepTrack(this._removeDevice(deviceId), deviceId, DeviceAction.REMOVE))
				}
			}
		}

		const resultsOrTimeout = await Promise.race<UpdateDeviceOperationsResult>([
			Promise.all(ps).then((results) => ({
				success: true,
				results,
			})),
			new Promise<UpdateDeviceOperationsResult>((resolve) =>
				setTimeout(() => {
					const keys = Object.keys(promiseOperations)
					if (keys.length) {
						this.logger.warn(
							`Timeout in _updateDevices: ${Object.values(promiseOperations)
								.map((op) => op.deviceId)
								.join(',')}`
						)
					}

					Promise.all(
						// At this point in time, promiseOperations contains the promises that have timed out.
						// If we tried to add or re-add a device, that apparently failed so we should remove the device in order to
						// give it another chance next time _updateDevices() is called.
						Object.values(promiseOperations)
							.filter((op) => op.operation === DeviceAction.ADD || op.operation === DeviceAction.READD)
							.map(async (op) =>
								// the device was never added, should retry next round
								this._removeDevice(op.deviceId)
							)
					)
						.catch((e) => {
							this.logger.error(
								`Error when trying to remove unsuccessfully initialized devices: ${stringifyIds(
									Object.values(promiseOperations).map((op) => op.deviceId)
								)}`,
								e
							)
						})
						.finally(() => {
							resolve({
								success: false,
								reason: 'error',
								details: keys,
							})
						})
				}, INIT_TIMEOUT)
			), // Timeout if not all are resolved within INIT_TIMEOUT
		])

		await this._reportResult(resultsOrTimeout)

		const debugLoggingPs: Promise<any>[] = []
		// Set logDebug on the devices:
		for (const device of this.tsr.getDevices()) {
			const options: DeviceOptionsAny | undefined = deviceOptions.get(device.deviceId)
			if (!options) {
				continue
			}
			const debug: boolean = this.getDeviceDebug(options)
			if (device.debugLogging !== debug) {
				this.logger.info(`Setting logDebug of device ${device.deviceId} to ${debug}`)
				debugLoggingPs.push(device.setDebugLogging(debug))
			}
		}
		await Promise.all(debugLoggingPs)

		this._triggerupdateExpectedPlayoutItems() // So that any recently created devices will get all the ExpectedPlayoutItems
		this.logger.debug('updateDevices end')
	}
	private getDeviceDebug(deviceOptions: DeviceOptionsAny): boolean {
		return deviceOptions.debug || this._coreHandler.logDebug || false
	}
	private async _reportResult(resultsOrTimeout: UpdateDeviceOperationsResult): Promise<void> {
		this.logger.warn(JSON.stringify(resultsOrTimeout))
		// Check if the updateDevice operation failed before completing
		if (!resultsOrTimeout.success) {
			// It failed because there was a global timeout (not a device-specific failure)
			if (resultsOrTimeout.reason === 'timeout') {
				await this._coreHandler.core.setStatus({
					statusCode: StatusCode.FATAL,
					messages: [
						`Time-out during device update. Timed-out on devices: ${stringifyIds(
							resultsOrTimeout.details
						)}`,
					],
				})
				// It failed for an unknown reason
			} else {
				await this._coreHandler.core.setStatus({
					statusCode: StatusCode.BAD,
					messages: [
						`Unknown error during device update: ${resultsOrTimeout.reason}. Devices: ${stringifyIds(
							resultsOrTimeout.details
						)}`,
					],
				})
			}

			return
		}

		// updateDevice finished successfully, let's see if any of the individual devices failed
		const failures = resultsOrTimeout.results.filter((result) => !result.success)
		// Group the failures according to what sort of an operation was executed
		const addFailureDeviceIds = failures
			.filter((failure) => failure.action === DeviceAction.ADD)
			.map((failure) => failure.deviceId)
		const removeFailureDeviceIds = failures
			.filter((failure) => failure.action === DeviceAction.REMOVE)
			.map((failure) => failure.deviceId)

		// There were no failures, good
		if (failures.length === 0) {
			await this._coreHandler.core.setStatus({
				statusCode: StatusCode.GOOD,
				messages: [],
			})
			return
		}
		// Something did fail, let's report it as the status
		await this._coreHandler.core.setStatus({
			statusCode: StatusCode.BAD,
			messages: [
				addFailureDeviceIds.length > 0
					? `Unable to initialize devices, check configuration: ${stringifyIds(addFailureDeviceIds)}`
					: null,
				removeFailureDeviceIds.length > 0
					? `Failed to remove devices: ${stringifyIds(removeFailureDeviceIds)}`
					: null,
			].filter(Boolean) as string[],
		})
	}

	private async _addDevice(deviceId: string, options: DeviceOptionsAny): Promise<DeviceActionResult> {
		this.logger.debug('Adding device ' + deviceId)

		try {
			if (this._coreTsrHandlers[deviceId]) {
				throw new Error(`There is already a _coreTsrHandlers for deviceId "${deviceId}"!`)
			}

			const devicePr: Promise<DeviceContainer<DeviceOptionsAny>> = this.tsr.createDevice(deviceId, options)

			const coreTsrHandler = new CoreTSRDeviceHandler(this._coreHandler, devicePr, deviceId, this)

			this._coreTsrHandlers[deviceId] = coreTsrHandler

			// set the status to uninitialized for now:
			coreTsrHandler.statusChanged({
				statusCode: StatusCode.BAD,
				messages: ['Device initialising...'],
			})

			const device = await devicePr

			// Set up device status
			const deviceType = device.deviceType

			const onDeviceStatusChanged = (connectedOrStatus: Partial<DeviceStatus>) => {
				let deviceStatus: Partial<StatusObject>
				if (_.isBoolean(connectedOrStatus)) {
					// for backwards compability, to be removed later
					if (connectedOrStatus) {
						deviceStatus = {
							statusCode: StatusCode.GOOD,
						}
					} else {
						deviceStatus = {
							statusCode: StatusCode.BAD,
							messages: ['Disconnected'],
						}
					}
				} else {
					deviceStatus = connectedOrStatus
				}
				coreTsrHandler.statusChanged(deviceStatus)

				// When the status has changed, the deviceName might have changed:
				device.reloadProps().catch((err) => {
					this.logger.error(`Error in reloadProps: ${err}`)
				})
				// hack to make sure atem has media after restart
				if (
					(deviceStatus.statusCode === StatusCode.GOOD ||
						deviceStatus.statusCode === StatusCode.WARNING_MINOR ||
						deviceStatus.statusCode === StatusCode.WARNING_MAJOR) &&
					deviceType === DeviceType.ATEM &&
					!disableAtemUpload
				) {
					const assets = (options as DeviceOptionsAtem).options?.mediaPoolAssets
					if (assets && assets.length > 0) {
						try {
							this.uploadFilesToAtem(
								device,
								assets.filter((asset) => _.isNumber(asset.position) && asset.path)
							)
						} catch (e) {
							// don't worry about it.
						}
					}
				}
			}
			const onSlowSentCommand = (info: SlowSentCommandInfo) => {
				// If the internalDelay is too large, it should be logged as an error,
				// since something took too long internally.

				if (info.internalDelay > 100) {
					this.logger.error('slowSentCommand', {
						deviceName: device.deviceName,
						...info,
					})
				} else {
					this.logger.warn('slowSentCommand', {
						deviceName: device.deviceName,
						...info,
					})
				}
			}
			const onSlowFulfilledCommand = (info: SlowFulfilledCommandInfo) => {
				// Note: we don't emit slow fulfilled commands as error, since
				// the fulfillment of them lies on the device being controlled, not on us.

				this.logger.warn('slowFulfilledCommand', {
					deviceName: device.deviceName,
					...info,
				})
			}
			const onCommandReport = (commandReport: CommandReport) => {
				if (this._reportAllCommands) {
					// Todo: send these to Core
					this.logger.info('commandReport', {
						commandReport: commandReport,
					})
				}
			}
			const onCommandError = (error: any, context: any) => {
				// todo: handle this better
				this.logger.error(error)
				this.logger.debug(context)
			}
			const onUpdateMediaObject = (collectionId: string, docId: string, doc: MediaObject | null) => {
				coreTsrHandler.onUpdateMediaObject(collectionId, docId, doc)
			}
			const onClearMediaObjectCollection = (collectionId: string) => {
				coreTsrHandler.onClearMediaObjectCollection(collectionId)
			}
			const fixError = (e: any): string => {
				const name = `Device "${device.deviceName || deviceId}" (${device.instanceId})`
				if (e.reason) e.reason = name + ': ' + e.reason
				if (e.message) e.message = name + ': ' + e.message
				if (e.stack) {
					e.stack += '\nAt device' + name
				}
				if (_.isString(e)) e = name + ': ' + e

				return e
			}
			await coreTsrHandler.init()

			device.onChildClose = () => {
				// Called if a child is closed / crashed
				this.logger.warn(`Child of device ${deviceId} closed/crashed`)
				debug(`Trigger update devices because "${deviceId}" process closed`)

				onDeviceStatusChanged({
					statusCode: StatusCode.BAD,
					messages: ['Child process closed'],
				})

				this._removeDevice(deviceId).then(
					() => {
						this._triggerUpdateDevices()
					},
					() => {
						this._triggerUpdateDevices()
					}
				)
			}
			// Note for the future:
			// It is important that the callbacks returns void,
			// otherwise there might be problems with threadedclass!

			await device.device.on('connectionChanged', onDeviceStatusChanged as () => void)
			// await device.device.on('slowCommand', onSlowCommand)
			await device.device.on('slowSentCommand', onSlowSentCommand as () => void)
			await device.device.on('slowFulfilledCommand', onSlowFulfilledCommand as () => void)
			await device.device.on('commandError', onCommandError as () => void)
			await device.device.on('commandReport', onCommandReport as () => void)
			await device.device.on('updateMediaObject', onUpdateMediaObject as () => void)
			await device.device.on('clearMediaObjects', onClearMediaObjectCollection as () => void)

			await device.device.on('info', ((e: any, ...args: any[]) => {
				this.logger.info(fixError(e), ...args)
			}) as () => void)
			await device.device.on('warning', ((e: any, ...args: any[]) => {
				this.logger.warn(fixError(e), ...args)
			}) as () => void)
			await device.device.on('error', ((e: any, ...args: any[]) => {
				this.logger.error(fixError(e), ...args)
			}) as () => void)

			await device.device.on('debug', (...args: any[]) => {
				if (!device.debugLogging && !this._coreHandler.logDebug) {
					return
				}
				if (args.length === 0) {
					this.logger.debug('>empty message<')
					return
				}
				const data = args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : arg))
				this.logger.debug(`Device "${device.deviceName || deviceId}" (${device.instanceId})`, { data })
			})

			await device.device.on('timeTrace', ((trace: FinishedTrace) => sendTrace(trace)) as () => void)

			// now initialize it
			await this.tsr.initDevice(deviceId, options)

			// also ask for the status now, and update:
			onDeviceStatusChanged(await device.device.getStatus())
			return {
				action: DeviceAction.ADD,
				deviceId,
				success: true,
			}
		} catch (error) {
			// Initialization failed, clean up any artifacts and see if we can try again later:
			this.logger.error(`Error when adding device "${deviceId}"`, { data: error })
			debug(`Error when adding device "${deviceId}"`)
			try {
				await this._removeDevice(deviceId)
			} catch (error) {
				this.logger.error(`Error when cleaning up after adding device "${deviceId}" error...`, { data: error })
			}

			if (!this._triggerUpdateDevicesTimeout) {
				this._triggerUpdateDevicesTimeout = setTimeout(() => {
					debug(`Trigger updateDevices from failure "${deviceId}"`)
					// try again later:
					this._triggerUpdateDevices()
				}, 10 * 1000)
			}

			return {
				action: DeviceAction.ADD,
				deviceId,
				success: false,
			}
		}
	}
	/**
	 * This function is a quick and dirty solution to load a still to the atem mixers.
	 * This does not serve as a proper implementation! And need to be refactor
	 * // @todo: proper atem media management
	 * /Balte - 22-08
	 */
	private uploadFilesToAtem(device: DeviceContainer<DeviceOptionsAny>, files: AtemMediaPoolAsset[]) {
		if (!device || device.deviceType !== DeviceType.ATEM) {
			return
		}
		this.logger.info('try to load ' + JSON.stringify(files.map((f) => f.path).join(', ')) + ' to atem')
		const options = device.deviceOptions.options as { host: string }
		this.logger.info('options ' + JSON.stringify(options))
		if (!options || !options.host) {
			throw Error('ATEM host option not set')
		}
		this.logger.info('uploading files to ' + options.host)
		const process = cp.spawn(`node`, [`./dist/atemUploader.js`, options.host, JSON.stringify(files)])
		process.stdout.on('data', (data) => this.logger.info(data.toString()))
		process.stderr.on('data', (data) => this.logger.info(data.toString()))
		process.on('close', () => process.removeAllListeners())
	}
	private async _removeDevice(deviceId: string): Promise<DeviceActionResult> {
		let success = false
		if (this._coreTsrHandlers[deviceId]) {
			try {
				await this._coreTsrHandlers[deviceId].dispose()
				this.logger.debug('Disposed device ' + deviceId)
				success = true
			} catch (error) {
				this.logger.error(`Error when removing device "${deviceId}"`, { data: error })
			}
		}
		delete this._coreTsrHandlers[deviceId]

		return {
			deviceId,
			action: DeviceAction.REMOVE,
			success,
		}
	}
	private _triggerupdateExpectedPlayoutItems() {
		if (!this._initialized) return
		if (this._triggerupdateExpectedPlayoutItemsTimeout) {
			clearTimeout(this._triggerupdateExpectedPlayoutItemsTimeout)
		}
		this._triggerupdateExpectedPlayoutItemsTimeout = setTimeout(() => {
			this._updateExpectedPlayoutItems().catch((error) =>
				this.logger.error('Error in _updateExpectedPlayoutItems', { data: error })
			)
		}, 200)
	}
	private async _updateExpectedPlayoutItems() {
		const expectedPlayoutItems = this._coreHandler.core.getCollection('expectedPlayoutItems')
		const peripheralDevice = this._getPeripheralDevice()

		const expectedItems = expectedPlayoutItems.find({
			studioId: peripheralDevice.studioId,
		})
		const rundowns = _.indexBy(
			this._coreHandler.core.getCollection('rundowns').find({
				studioId: peripheralDevice.studioId,
			}),
			'_id'
		)

		await Promise.all(
			_.map(this.tsr.getDevices(), async (container) => {
				if (!(await container.device.supportsExpectedPlayoutItems)) {
					return
				}
				await container.device.handleExpectedPlayoutItems(
					_.map(
						_.filter(
							expectedItems,
							(item) => item.deviceSubType === container.deviceType
							// TODO: implement item.deviceId === container.deviceId
						),
						(item): ExpectedPlayoutItem => {
							const itemContent: ExpectedPlayoutItemContent = item.content
							return {
								...itemContent,
								rundownId: item.rundownId,
								playlistId: item.rundownId && rundowns[item.rundownId]?.playlistId,
								baseline: item.baseline,
							}
						}
					)
				)
			})
		)
	}
	/**
	 * Go through and transform timeline and generalize the Core-specific things
	 * @param timeline
	 */
	private _transformTimeline(timeline: Array<TimelineObjGeneric>): TSRTimeline {
		// _transformTimeline (timeline: Array<TimelineObj>): Array<TimelineContentObject> | null {

		const transformObject = (obj: TimelineObjGeneric): TimelineContentObjectTmp => {
			// TODO - this cast to any feels dangerous. Are any of these 'fixes' necessary?
			const transformedObj: any = obj

			if (!transformedObj.content) transformedObj.content = {}
			if (transformedObj.isGroup) {
				if (!transformedObj.content.objects) transformedObj.content.objects = []
			}

			return transformedObj
		}

		// First, transform and convert timeline to a key-value store, for fast referencing:
		const objects: { [id: string]: TimelineContentObjectTmp } = {}
		_.each(timeline, (obj: TimelineObjGeneric) => {
			const transformedObj = transformObject(obj)
			objects[transformedObj.id] = transformedObj
		})

		// Go through all objects:
		const transformedTimeline: Array<TSRTimelineObj> = []
		_.each(objects, (obj: TimelineContentObjectTmp) => {
			if (!obj.inGroup) {
				// Add object to timeline
				delete obj.inGroup
				transformedTimeline.push(obj as TSRTimelineObj)
				return
			}
			const groupObj = objects[obj.inGroup]
			if (!groupObj) {
				// referenced group not found
				this.logger.error(`Referenced group "${obj.inGroup}" not found! Referenced by "${obj.id}"`)
				return
			}
			// Add object into group:
			if (!groupObj.children) groupObj.children = []
			if (groupObj.children) {
				delete obj.inGroup
				groupObj.children.push(obj)
			}
		})
		return transformedTimeline
	}

	private changedResults: PlayoutChangedResults | undefined = undefined
	private sendCallbacksTimeout: NodeJS.Timer | undefined = undefined

	private sendChangedResults = (): void => {
		this.sendCallbacksTimeout = undefined
		this._coreHandler.core
			.callMethod(PeripheralDeviceAPIMethods.playoutPlaybackChanged, [this.changedResults])
			.catch((error) => {
				this.logger.error('Error in timelineCallback', { data: error })
			})
		this.changedResults = undefined
	}

	private handleTSRTimelineCallback(
		time: number,
		objId: string,
		callbackName0: string,
		data: PartPlaybackCallbackData | PiecePlaybackCallbackData
	): void {
		if (
			![
				PlayoutChangedType.PART_PLAYBACK_STARTED,
				PlayoutChangedType.PART_PLAYBACK_STOPPED,
				PlayoutChangedType.PIECE_PLAYBACK_STARTED,
				PlayoutChangedType.PIECE_PLAYBACK_STOPPED,
			].includes(callbackName0 as PlayoutChangedType)
		) {
			// @ts-expect-error Untyped bunch of methods
			const method = PeripheralDeviceAPIMethods[callbackName]
			if (!method) {
				this.logger.error(`Unknown callback method "${callbackName0}"`)
				return
			}
			this._coreHandler.core
				.callMethod(method, [
					Object.assign({}, data, {
						objId: objId,
						time: time,
					}),
				])
				.catch((error) => {
					this.logger.error('Error in timelineCallback', { data: error })
				})
			return
		}
		const callbackName = callbackName0 as PlayoutChangedType
		// debounce
		if (this.changedResults && this.changedResults.rundownPlaylistId !== data.rundownPlaylistId) {
			// The playlistId changed. Send what we have right away and reset:
			this._coreHandler.core
				.callMethod(PeripheralDeviceAPIMethods.playoutPlaybackChanged, [this.changedResults])
				.catch((error) => this.logger.error('Error in timelineCallback', { data: error }))
			this.changedResults = undefined
		}
		if (!this.changedResults) {
			this.changedResults = {
				rundownPlaylistId: data.rundownPlaylistId,
				changes: [],
			}
		}

		switch (callbackName) {
			case PlayoutChangedType.PART_PLAYBACK_STARTED:
			case PlayoutChangedType.PART_PLAYBACK_STOPPED:
				this.changedResults.changes.push({
					type: callbackName,
					objId,
					data: {
						time,
						partInstanceId: (data as PartPlaybackCallbackData).partInstanceId,
					},
				})
				break
			case PlayoutChangedType.PIECE_PLAYBACK_STARTED:
			case PlayoutChangedType.PIECE_PLAYBACK_STOPPED:
				this.changedResults.changes.push({
					type: callbackName,
					objId,
					data: {
						time,
						partInstanceId: (data as PiecePlaybackCallbackData).partInstanceId,
						pieceInstanceId: (data as PiecePlaybackCallbackData).pieceInstanceId,
					},
				})
				break
			default:
				assertNever(callbackName)
		}

		// Based on the use-case, we generally expect the callbacks to come in batches, so it only makes sense
		// to wait a little bit to collect the changed callbacks
		if (!this.sendCallbacksTimeout) {
			this.sendCallbacksTimeout = setTimeout(this.sendChangedResults, 20)
		}
	}
}

export function getHash(str: string): string {
	const hash = crypto.createHash('sha1')
	return hash.update(str).digest('base64').replace(/[+/=]/g, '_') // remove +/= from strings, because they cause troubles
}

export function stringifyIds(ids: string[]): string {
	return ids.map((id) => `"${id}"`).join(', ')
}
