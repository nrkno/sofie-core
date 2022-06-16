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
import { CoreConnection, PeripheralDeviceAPI as P } from '@sofie-automation/server-core-integration'
import { TimelineObjectCoreExt } from '@sofie-automation/blueprints-integration'
import { Logger } from 'winston'
import { disableAtemUpload } from './config'
import Debug from 'debug'
import { FinishedTrace, sendTrace } from './influxdb'

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
export interface TimelineObjGeneric extends TimelineObjectCoreExt {
	/** Unique _id (generally obj.studioId + '_' + obj.id) */
	_id: string
	/** Unique within a timeline (ie within a studio) */
	id: string

	/** Studio installation Id */
	studioId: string

	objectType: TimelineObjType

	enable: TimelineTypes.TimelineEnable & {
		setFromNow?: boolean
	}

	inGroup?: string

	metadata?: {
		[key: string]: any
	}

	/** Only set to true when an object is inserted by lookahead */
	isLookahead?: boolean
	/** Set when an object is on a virtual layer for lookahead, so that it can be routed correctly */
	originalLLayer?: string | number
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
export interface TimelineComplete {
	_id: string
	timeline: Array<TimelineObjGeneric>
}
// ----------------------------------------------------------------------------

export interface TimelineContentObjectTmp extends TSRTimelineObjBase {
	inGroup?: string
}
/** Max time for initializing devices */
const INIT_TIMEOUT = 10000
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
			// let cmdInfo: string = args[0] + ''
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
			if (this._coreHandler.logDebug) {
				const msg: any = {
					message: 'TSR debug message (' + args.length + ')',
					data: [],
				}
				if (args.length) {
					if (typeof args === 'string') {
						msg.data.push(args)
					} else {
						for (const arg of args) {
							if (typeof arg === 'object') {
								msg.data.push(JSON.stringify(arg))
							} else {
								msg.data.push(arg)
							}
						}
					}
				} else {
					msg.data.push('>empty message<')
				}

				this.logger.debug(msg)
			}
		})

		this.tsr.on('setTimelineTriggerTime', (r: TimelineTriggerTimeResult) => {
			this._coreHandler.core.callMethod(P.methods.timelineTriggerTime, [r]).catch((e) => {
				this.logger.error('Error in setTimelineTriggerTime', e)
			})
		})
		this.tsr.on('timelineCallback', (time, objId, callbackName, data) => {
			// @ts-expect-error Untyped bunch of methods
			const method = P.methods[callbackName]
			if (method) {
				this._coreHandler.core
					.callMethod(method, [
						Object.assign({}, data, {
							objId: objId,
							time: time,
						}),
					])
					.catch((e) => {
						this.logger.error('Error in timelineCallback', e)
					})
			} else {
				this.logger.error(`Unknown callback method "${callbackName}"`)
			}
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
				.catch((e) => {
					this.logger.error('Error in reportResolveDone', e)
				})

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
	getTimeline():
		| {
				// Copied from Core:
				_id: string // Studio id
				mappingsHash: string
				timelineHash: string
				// this is the old way of storing the timeline, kept for backwards-compatibility
				timeline?: TimelineObjGeneric[]
				timelineBlob: string
				generated: number
				published: number
		  }
		| undefined {
		const studioId = this._getStudioId()
		if (!studioId) {
			this.logger.warn('no studioId')
			return undefined
		}

		const timeline = this._coreHandler.core.getCollection('studioTimeline').findOne((o: TimelineComplete) => {
			return o._id === studioId
		})

		return timeline as any
	}
	getMappings():
		| {
				_id: string // Studio id
				mappingsHash: string
				mappings: Mappings
		  }
		| undefined {
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
			).toISOString()}, pub: ${new Date(timeline.published).toISOString()})`
		)
		if (fromTlChange) {
			const trace = {
				measurement: 'playout-gateway:timelineReceived',
				start: timeline.generated,
				tags: {},
				ended: Date.now(),
				duration: Date.now() - timeline.generated,
			}
			sendTrace(trace)
			sendTrace({
				measurement: 'playout-gateway:timelinePublicationLatency',
				start: timeline.published,
				tags: {},
				ended: Date.now(),
				duration: Date.now() - timeline.published,
			})
		}

		const transformedTimeline = timeline.timelineBlob
			? this._transformTimeline(JSON.parse(timeline.timelineBlob) as Array<TimelineObjGeneric>)
			: timeline.timeline
			? this._transformTimeline(timeline.timeline)
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
		if (peripheralDevice) {
			const studios = this._coreHandler.core.getCollection('studios')
			return studios.findOne(peripheralDevice.studioId)
		}
		return null
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

		if (this._triggerUpdateDevicesTimeout) clearTimeout(this._triggerUpdateDevicesTimeout)
		this._triggerUpdateDevicesTimeout = undefined

		if (!this._updateDevicesIsRunning) {
			this._updateDevicesIsRunning = true
			debug('triggerUpdateDevices now')

			// Defer:
			setTimeout(() => {
				this._updateDevices().then(
					() => {
						this._updateDevicesIsRunning = false
						if (this._triggerUpdateDevicesCheckAgain) {
							debug('triggerUpdateDevices from updateDevices promise resolved')
							if (this._triggerUpdateDevicesTimeout) clearTimeout(this._triggerUpdateDevicesTimeout)
							this._triggerUpdateDevicesTimeout = setTimeout(() => this._triggerUpdateDevices(), 1000)
						}
						this._triggerUpdateDevicesCheckAgain = false
					},
					() => {
						this._updateDevicesIsRunning = false
						if (this._triggerUpdateDevicesCheckAgain) {
							debug('triggerUpdateDevices from updateDevices promise rejected')
							setTimeout(() => this._triggerUpdateDevices(), 1000)
							if (this._triggerUpdateDevicesTimeout) clearTimeout(this._triggerUpdateDevicesTimeout)
							this._triggerUpdateDevicesTimeout = setTimeout(() => this._triggerUpdateDevices(), 1000)
						}
						this._triggerUpdateDevicesCheckAgain = false
					}
				)
			}, 10)
		} else {
			// oh, it's already running, cue a check again later:
			debug('triggerUpdateDevices already running, cue a check again later')
			this._triggerUpdateDevicesCheckAgain = true
		}
	}
	private async _updateDevices(): Promise<void> {
		this.logger.info('updateDevices start')

		const peripheralDevices = this._coreHandler.core.getCollection('peripheralDevices')
		const peripheralDevice = peripheralDevices.findOne(this._coreHandler.core.deviceId)

		let ps: Promise<any>[] = []
		const promiseOperations: { [id: string]: true } = {}
		const keepTrack = async <T>(p: Promise<T>, name: string) => {
			promiseOperations[name] = true
			return p.then((result) => {
				delete promiseOperations[name]
				return result
			})
		}
		const devices = new Map<string, DeviceOptionsAny>()

		if (peripheralDevice) {
			const settings: TSRSettings = peripheralDevice.settings || {}

			for (const [deviceId, device] of Object.entries(settings.devices)) {
				if (!device.disable) {
					devices.set(deviceId, device)
				}
			}

			for (const [deviceId, orgDeviceOptions] of devices.entries()) {
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
						ps.push(keepTrack(this._addDevice(deviceId, deviceOptions), 'add_' + deviceId))
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
								keepTrack(this._removeDevice(deviceId), 'remove_' + deviceId).then(async () => {
									return keepTrack(this._addDevice(deviceId, deviceOptions), 're-add_' + deviceId)
								})
							)
						}
					}
				}
			}

			for (const oldDevice of this.tsr.getDevices()) {
				const deviceId = oldDevice.deviceId
				if (!devices.has(deviceId)) {
					this.logger.info('Un-initializing device: ' + deviceId)
					ps.push(keepTrack(this._removeDevice(deviceId), 'remove_' + deviceId))
				}
			}
		}

		await Promise.race([
			Promise.all(ps),
			new Promise<void>((resolve) =>
				setTimeout(() => {
					const keys = _.keys(promiseOperations)
					if (keys.length) {
						this.logger.warn(`Timeout in _updateDevices: ${keys.join(',')}`)
					}
					resolve()
				}, INIT_TIMEOUT)
			), // Timeout if not all are resolved within INIT_TIMEOUT
		])
		ps = []

		// Set logDebug on the devices:
		for (const device of this.tsr.getDevices()) {
			const deviceOptions = devices.get(device.deviceId)
			if (deviceOptions) {
				const debug: boolean = this.getDeviceDebug(deviceOptions)
				if (device.debugLogging !== debug) {
					this.logger.info(`Setting logDebug of device ${device.deviceId} to ${debug}`)
					ps.push(device.setDebugLogging(debug))
				}
			}
		}
		await Promise.all(ps)

		this._triggerupdateExpectedPlayoutItems() // So that any recently created devices will get all the ExpectedPlayoutItems
		this.logger.info('updateDevices end')
	}
	private getDeviceDebug(deviceOptions: DeviceOptionsAny): boolean {
		return deviceOptions.debug || this._coreHandler.logDebug || false
	}
	private async _addDevice(deviceId: string, options: DeviceOptionsAny): Promise<any> {
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
				let deviceStatus: Partial<P.StatusObject>
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
				// the fullfillement of them lies on the device being controlled, not on us.

				this.logger.warn('slowFulfilledCommand', {
					deviceName: device.deviceName,
					...info,
				})
			}
			/*const onCommandError = (error: Error, context: CommandWithContext) => {
				if (this._errorReporting) {
					this.logger.warn('CommandError', device.deviceId, error.toString())
					this.logger.info('Command context', context.timelineObjId, context.context)

					// find the corresponding timeline object:
					const obj = _.find(this.tsr.timeline, (obj) => {
						return obj.id === context.timelineObjId
					})

					const errorString: string = device.deviceName +
					(
						error instanceof Error ?
							error.toString() :
						_.isObject(error) ?
							JSON.stringify(error) :
						error + ''
					)
					coreTsrHandler.onCommandError(errorString, {
						timelineObjId:	context.timelineObjId,
						context: 		context.context,
						partId:		obj ? obj['partId']		: undefined,
						pieceId:	obj ? obj['pieceId']	: undefined
					})
				} else {
					this.logger.warn('CommandError', device.deviceId, error.toString(), error.stack)
				}
			}*/
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
				if (device.debugLogging || this._coreHandler.logDebug) {
					const msg: any = {
						message: `debug: Device "${device.deviceName || deviceId}" (${device.instanceId})`,
						data: [],
					}
					if (args.length) {
						if (typeof args === 'string') {
							msg.data.push(args)
						} else {
							for (const arg of args) {
								if (typeof arg === 'object') {
									msg.data.push(JSON.stringify(arg))
								} else {
									msg.data.push(arg)
								}
							}
						}
					} else {
						msg.data.push('>empty message<')
					}

					this.logger.debug(msg)
				}
			})

			await device.device.on('timeTrace', ((trace: FinishedTrace) => sendTrace(trace)) as () => void)

			// now initialize it
			await this.tsr.initDevice(deviceId, options)

			// also ask for the status now, and update:
			onDeviceStatusChanged(await device.device.getStatus())
		} catch (e) {
			// Initialization failed, clean up any artifacts and see if we can try again later:
			this.logger.error(`Error when adding device "${deviceId}"`, e)
			debug(`Error when adding device "${deviceId}"`)
			try {
				await this._removeDevice(deviceId)
			} catch (e) {
				this.logger.error(`Error when cleaning up after adding device "${deviceId}" error...`, e)
			}

			if (!this._triggerUpdateDevicesTimeout) {
				this._triggerUpdateDevicesTimeout = setTimeout(() => {
					debug(`Trigger updateDevices from failure "${deviceId}"`)
					// try again later:
					this._triggerUpdateDevices()
				}, 10 * 1000)
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
		if (device && device.deviceType === DeviceType.ATEM) {
			this.logger.info('try to load ' + JSON.stringify(files.map((f) => f.path).join(', ')) + ' to atem')
			const options = device.deviceOptions.options as { host: string }
			this.logger.info('options ' + JSON.stringify(options))
			if (options && options.host) {
				this.logger.info('uploading files to ' + options.host)
				const process = cp.spawn(`node`, [`./dist/atemUploader.js`, options.host, JSON.stringify(files)])
				process.stdout.on('data', (data) => this.logger.info(data.toString()))
				process.stderr.on('data', (data) => this.logger.info(data.toString()))
				process.on('close', () => {
					process.removeAllListeners()
				})
			} else {
				throw Error('ATEM host option not set')
			}
		}
	}
	private async _removeDevice(deviceId: string): Promise<any> {
		if (this._coreTsrHandlers[deviceId]) {
			try {
				await this._coreTsrHandlers[deviceId].dispose()
				this.logger.debug('Disposed device ' + deviceId)
			} catch (e) {
				this.logger.error(`Error when removing device "${deviceId}"`, e)
			}
		}
		delete this._coreTsrHandlers[deviceId]
	}
	private _triggerupdateExpectedPlayoutItems() {
		if (!this._initialized) return
		if (this._triggerupdateExpectedPlayoutItemsTimeout) {
			clearTimeout(this._triggerupdateExpectedPlayoutItemsTimeout)
		}
		this._triggerupdateExpectedPlayoutItemsTimeout = setTimeout(() => {
			this._updateExpectedPlayoutItems().catch((e) =>
				this.logger.error('Error in _updateExpectedPlayoutItems', e)
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
				if (await container.device.supportsExpectedPlayoutItems) {
					await container.device.handleExpectedPlayoutItems(
						_.map(
							_.filter(expectedItems, (item) => {
								return (
									item.deviceSubType === container.deviceType
									// TODO: implement item.deviceId === container.deviceId
								)
							}),
							(item) => {
								const itemContent: ExpectedPlayoutItemContent = item.content
								const newItem: ExpectedPlayoutItem = {
									...itemContent,
									rundownId: item.rundownId,
									playlistId: item.rundownId && rundowns[item.rundownId]?.playlistId,
									baseline: item.baseline,
								}
								return newItem
							}
						)
					)
				}
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
			const transformedObj: any = clone(_.omit(obj, ['_id', 'studioId']))
			transformedObj.id = obj.id || obj._id

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
			if (obj.inGroup) {
				const groupObj = objects[obj.inGroup]
				if (groupObj) {
					// Add object into group:
					if (!groupObj.children) groupObj.children = []
					if (groupObj.children) {
						delete obj.inGroup
						groupObj.children.push(obj)
					}
				} else {
					// referenced group not found
					this.logger.error(
						'Referenced group "' + obj.inGroup + '" not found! Referenced by "' + obj.id + '"'
					)
				}
			} else {
				// Add object to timeline
				delete obj.inGroup
				transformedTimeline.push(obj as TSRTimelineObj)
			}
		})
		return transformedTimeline
	}
}

export function getHash(str: string): string {
	const hash = crypto.createHash('sha1')
	return hash.update(str).digest('base64').replace(/[+/=]/g, '_') // remove +/= from strings, because they cause troubles
}
