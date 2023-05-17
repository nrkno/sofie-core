import {
	CoreConnection,
	CoreOptions,
	DDPConnectorOptions,
	PeripheralDeviceAPI,
	PeripheralDeviceCommand,
	PeripheralDeviceId,
	PeripheralDeviceForDevice,
	protectString,
	StatusCode,
	StudioId,
	unprotectString,
} from '@sofie-automation/server-core-integration'
import { MediaObject, DeviceOptionsAny, ActionExecutionResult } from 'timeline-state-resolver'
import * as _ from 'underscore'
import { DeviceConfig } from './connector'
import { TSRHandler } from './tsrHandler'
import { Logger } from 'winston'
// eslint-disable-next-line node/no-extraneous-import
import { MemUsageReport as ThreadMemUsageReport } from 'threadedclass'
import { PLAYOUT_DEVICE_CONFIG } from './configManifest'
import { BaseRemoteDeviceIntegration } from 'timeline-state-resolver/dist/service/remoteDeviceInstance'
import { getVersions } from './versions'
import { CoreConnectionChild } from '@sofie-automation/server-core-integration/dist/lib/CoreConnectionChild'
import { PlayoutGatewayConfig } from './generated/options'

export interface CoreConfig {
	host: string
	port: number
	watchdog: boolean
}

export interface MemoryUsageReport {
	main: number
	threads: { [childId: string]: ThreadMemUsageReport }
}

/**
 * Represents a connection between the Gateway and Core
 */
export class CoreHandler {
	core!: CoreConnection
	logger: Logger
	public _observers: Array<any> = []
	public deviceSettings: PlayoutGatewayConfig = {}

	public multithreading = false
	public reportAllCommands = false

	private _deviceOptions: DeviceConfig
	private _onConnected?: () => any
	private _executedFunctions: { [id: string]: boolean } = {}
	private _tsrHandler?: TSRHandler
	private _coreConfig?: CoreConfig
	private _certificates?: Buffer[]

	private _studioId: StudioId | undefined
	private _timelineSubscription: string | null = null
	private _expectedItemsSubscription: string | null = null

	private _statusInitialized = false
	private _statusDestroyed = false

	constructor(logger: Logger, deviceOptions: DeviceConfig) {
		this.logger = logger
		this._deviceOptions = deviceOptions
	}

	async init(config: CoreConfig, certificates: Buffer[]): Promise<void> {
		this._statusInitialized = false
		this._coreConfig = config
		this._certificates = certificates

		this.core = new CoreConnection(this.getCoreConnectionOptions())

		this.core.onConnected(() => {
			this.logger.info('Core Connected!')
			this.setupObserversAndSubscriptions().catch((e: any) => {
				this.logger.error(`Core Error during setupObserversAndSubscriptions: ${e}`, { error: e })
			})
			if (this._onConnected) this._onConnected()
		})
		this.core.onDisconnected(() => {
			this.logger.warn('Core Disconnected!')
		})
		this.core.onError((err: any) => {
			this.logger.error('Core Error: ' + (typeof err === 'string' ? err : err.message || err.toString() || err))
		})

		const ddpConfig: DDPConnectorOptions = {
			host: config.host,
			port: config.port,
		}
		if (this._certificates.length) {
			ddpConfig.tlsOpts = {
				ca: this._certificates,
			}
		}

		await this.core.init(ddpConfig)

		this.logger.info('Core id: ' + this.core.deviceId)
		await this.setupObserversAndSubscriptions()
		if (this._onConnected) this._onConnected()

		this._statusInitialized = true
		await this.updateCoreStatus()
	}
	setTSR(tsr: TSRHandler): void {
		this._tsrHandler = tsr
	}
	async setupObserversAndSubscriptions(): Promise<void> {
		this.logger.info('Core: Setting up subscriptions..')
		this.logger.info('DeviceId: ' + this.core.deviceId)
		await Promise.all([
			this.core.autoSubscribe('peripheralDeviceForDevice', this.core.deviceId),
			this.core.autoSubscribe('mappingsForDevice', this.core.deviceId),
			this.core.autoSubscribe('timelineForDevice', this.core.deviceId),
			this.core.autoSubscribe('timelineDatastoreForDevice', this.core.deviceId),
			this.core.autoSubscribe('peripheralDeviceCommands', this.core.deviceId),
			this.core.autoSubscribe('rundownsForDevice', this.core.deviceId),
		])

		this.logger.info('Core: Subscriptions are set up!')
		if (this._observers.length) {
			this.logger.info('CoreMos: Clearing observers..')
			this._observers.forEach((obs) => {
				obs.stop()
			})
			this._observers = []
		}
		// setup observers
		const observer = this.core.observe('peripheralDeviceForDevice')
		observer.added = (id: string) => this.onDeviceChanged(protectString(id))
		observer.changed = (id: string) => this.onDeviceChanged(protectString(id))
		this.setupObserverForPeripheralDeviceCommands(this)
	}
	async destroy(): Promise<void> {
		this._statusDestroyed = true
		await this.updateCoreStatus()
		await this.core.destroy()
	}
	private getCoreConnectionOptions(): CoreOptions {
		if (!this._deviceOptions.deviceId) {
			// this.logger.warn('DeviceId not set, using a temporary random id!')
			throw new Error('DeviceId is not set!')
		}

		const options: CoreOptions = {
			deviceId: protectString(this._deviceOptions.deviceId + 'PlayoutCoreParent'),
			deviceToken: this._deviceOptions.deviceToken,

			deviceCategory: PeripheralDeviceAPI.PeripheralDeviceCategory.PLAYOUT,
			deviceType: PeripheralDeviceAPI.PeripheralDeviceType.PLAYOUT,

			deviceName: 'Playout gateway',
			watchDog: this._coreConfig ? this._coreConfig.watchdog : true,

			configManifest: PLAYOUT_DEVICE_CONFIG,

			versions: getVersions(this.logger),

			documentationUrl: 'https://github.com/nrkno/sofie-core',
		}

		if (!options.deviceToken) {
			this.logger.warn('Token not set, only id! This might be unsecure!')
			options.deviceToken = 'unsecureToken'
		}

		return options
	}
	onConnected(fcn: () => any): void {
		this._onConnected = fcn
	}
	onDeviceChanged(id: PeripheralDeviceId): void {
		if (id === this.core.deviceId) {
			const col = this.core.getCollection<PeripheralDeviceForDevice>('peripheralDeviceForDevice')
			if (!col) throw new Error('collection "peripheralDevices" not found!')

			const device = col.findOne(id)
			this.deviceSettings = device?.deviceSettings ?? {}

			const logLevel = this.deviceSettings.debugLogging ? 'debug' : 'info'
			if (logLevel !== this.logger.level) {
				this.logger.level = logLevel

				for (const transport of this.logger.transports) {
					transport.level = logLevel
				}

				this.logger.info('Loglevel: ' + this.logger.level)
			}

			if (this.deviceSettings.multiThreading !== this.multithreading) {
				this.multithreading = this.deviceSettings.multiThreading || false
			}
			if (this.deviceSettings.reportAllCommands !== this.reportAllCommands) {
				this.reportAllCommands = this.deviceSettings.reportAllCommands || false
			}

			const studioId = device?.studioId
			if (!studioId) throw new Error('PeripheralDevice has no studio!')

			if (studioId !== this._studioId) {
				this._studioId = studioId

				// Set up timeline data subscription:
				if (this._timelineSubscription) {
					this.core.unsubscribe(this._timelineSubscription)
					this._timelineSubscription = null
				}
				this.core
					.autoSubscribe('timeline', {
						studioId: studioId,
					})
					.then((subscriptionId: string | null) => {
						this._timelineSubscription = subscriptionId
					})
					.catch((err: any) => {
						this.logger.error(err)
					})

				// Set up expectedPlayoutItems data subscription:
				if (this._expectedItemsSubscription) {
					this.core.unsubscribe(this._expectedItemsSubscription)
					this._expectedItemsSubscription = null
				}
				this.core
					.autoSubscribe('expectedPlayoutItems', {
						studioId: studioId,
					})
					.then((subscriptionId: string | null) => {
						this._expectedItemsSubscription = subscriptionId
					})
					.catch((err: any) => {
						this.logger.error(err)
					})
				this.logger.debug('VIZDEBUG: Subscription to expectedPlayoutItems done')
			}

			if (this._tsrHandler) {
				this._tsrHandler.onSettingsChanged()
			}
		}
	}
	get logDebug(): boolean {
		return !!this.deviceSettings['debugLogging']
	}
	get logState(): boolean {
		return !!this.deviceSettings['debugState']
	}
	get estimateResolveTimeMultiplier(): number {
		if (!isNaN(Number(this.deviceSettings.estimateResolveTimeMultiplier))) {
			return this.deviceSettings.estimateResolveTimeMultiplier || 1
		} else return 1
	}

	executeFunction(cmd: PeripheralDeviceCommand, fcnObject: CoreHandler | CoreTSRDeviceHandler): void {
		if (cmd) {
			if (this._executedFunctions[unprotectString(cmd._id)]) return // prevent it from running multiple times

			const cb = (err: any, res?: any) => {
				if (err) {
					this.logger.error('executeFunction error', {
						error: err,
						stacktrace: err.stack,
					})
				}
				fcnObject.core.coreMethods.functionReply(cmd._id, err, res).catch((error: any) => {
					this.logger.error(error)
				})
			}

			if (cmd.functionName) {
				// Ignore specific commands, to reduce noise:
				if (cmd.functionName !== 'getDebugStates') {
					this.logger.debug(`Executing function "${cmd.functionName}", args: ${JSON.stringify(cmd.args)}`)
				}
				this._executedFunctions[unprotectString(cmd._id)] = true
				// @ts-expect-error Untyped bunch of functions
				// eslint-disable-next-line @typescript-eslint/ban-types
				const fcn: Function = fcnObject[cmd.functionName]
				try {
					if (!fcn) throw Error(`Function "${cmd.functionName}" not found on device "${cmd.deviceId}"!`)

					Promise.resolve(fcn.apply(fcnObject, cmd.args))
						.then((result) => {
							cb(null, result)
						})
						.catch((e) => {
							cb(e.toString(), null)
						})
				} catch (e: any) {
					cb(e.toString(), null)
				}
			} else if (cmd.actionId && 'executeAction' in fcnObject) {
				this.logger.debug(`Executing action "${cmd.actionId}", payload: ${JSON.stringify(cmd.payload)}`)
				this._executedFunctions[unprotectString(cmd._id)] = true

				fcnObject
					.executeAction(cmd.actionId, cmd.payload)
					.then((result) => cb(null, result))
					.catch((e) => cb(e.toString, null))
			} else if (cmd.actionId) {
				this.logger.warning(`Could not execute action "${cmd.actionId}", because there is no handler`)
				cb(`Could not execute action "${cmd.actionId}", because there is no handler`)
			} else {
				this.logger.debug('Received incomplete peripheralDeviceCommand')
				cb('Received incomplete peripheralDeviceCommand')
			}
		}
	}
	retireExecuteFunction(cmdId: string): void {
		delete this._executedFunctions[cmdId]
	}
	setupObserverForPeripheralDeviceCommands(functionObject: CoreTSRDeviceHandler | CoreHandler): void {
		const observer = functionObject.core.observe('peripheralDeviceCommands')
		functionObject._observers.push(observer)
		const addedChangedCommand = (id: string) => {
			const cmds = functionObject.core.getCollection<PeripheralDeviceCommand>('peripheralDeviceCommands')
			if (!cmds) throw Error('"peripheralDeviceCommands" collection not found!')
			const cmd = cmds.findOne(protectString(id))
			if (!cmd) throw Error('PeripheralCommand "' + id + '" not found!')
			// console.log('addedChangedCommand', id)
			if (cmd.deviceId === functionObject.core.deviceId) {
				this.executeFunction(cmd, functionObject)
			} else {
				// console.log('not mine', cmd.deviceId, this.core.deviceId)
			}
		}
		observer.added = (id: string) => {
			addedChangedCommand(id)
		}
		observer.changed = (id: string) => {
			addedChangedCommand(id)
		}
		observer.removed = (id: string) => {
			this.retireExecuteFunction(id)
		}
		const cmds = functionObject.core.getCollection<PeripheralDeviceCommand>('peripheralDeviceCommands')
		if (!cmds) throw Error('"peripheralDeviceCommands" collection not found!')
		cmds.find({}).forEach((cmd) => {
			if (cmd.deviceId === functionObject.core.deviceId) {
				this.executeFunction(cmd, functionObject)
			}
		})
	}
	killProcess(): void {
		this.logger.info('KillProcess command received, shutting down in 1000ms!')
		setTimeout(() => {
			// eslint-disable-next-line no-process-exit
			process.exit(0)
		}, 1000)
	}
	async devicesMakeReady(okToDestroyStuff?: boolean, activeRundownId?: string): Promise<any> {
		if (this._tsrHandler) {
			return this._tsrHandler.tsr.devicesMakeReady(okToDestroyStuff, activeRundownId)
		} else {
			throw Error('TSR not set up!')
		}
	}
	async devicesStandDown(okToDestroyStuff?: boolean): Promise<any> {
		if (this._tsrHandler) {
			return this._tsrHandler.tsr.devicesStandDown(okToDestroyStuff)
		} else {
			throw Error('TSR not set up!')
		}
	}
	pingResponse(message: string): void {
		this.core.setPingResponse(message)
	}
	getSnapshot(): any {
		this.logger.info('getSnapshot')
		const timeline = this._tsrHandler ? this._tsrHandler.getTimeline() : []
		const mappings = this._tsrHandler ? this._tsrHandler.getMappings() : []
		return {
			timeline: timeline,
			mappings: mappings,
		}
	}
	getDevicesInfo(): any {
		this.logger.info('getDevicesInfo')

		const devices: any[] = []
		if (this._tsrHandler) {
			for (const device of this._tsrHandler.tsr.getDevices()) {
				devices.push({
					instanceId: device.instanceId,
					deviceId: device.deviceId,
					deviceName: device.deviceName,
					startTime: device.startTime,
					upTime: Date.now() - device.startTime,
				})
			}
		}
		return devices
	}
	async getMemoryUsage(): Promise<MemoryUsageReport> {
		if (this._tsrHandler) {
			/** Convert all properties from bytes to MB */
			const toMB = (o: any) => {
				if (typeof o === 'object') {
					const o2: any = {}
					for (const key of Object.keys(o)) {
						o2[key] = toMB(o[key])
					}
					return o2
				} else if (typeof o === 'number') {
					return o / 1024 / 1024
				}
				return o
			}

			const values: MemoryUsageReport = {
				main: toMB(process.memoryUsage()),
				threads: toMB(await this._tsrHandler.tsr.getThreadsMemoryUsage()),
			}

			return toMB(values)
		} else {
			throw new Error('TSR not set up!')
		}
	}
	async getDebugStates(): Promise<any> {
		if (!this._tsrHandler) throw new Error('TSRHandler is not initialized')

		return Object.fromEntries(this._tsrHandler.getDebugStates().entries())
	}
	async updateCoreStatus(): Promise<any> {
		let statusCode = StatusCode.GOOD
		const messages: Array<string> = []

		if (!this._statusInitialized) {
			statusCode = StatusCode.BAD
			messages.push('Starting up...')
		}
		if (this._statusDestroyed) {
			statusCode = StatusCode.BAD
			messages.push('Shut down')
		}

		return this.core.setStatus({
			statusCode: statusCode,
			messages: messages,
		})
	}
}

export class CoreTSRDeviceHandler {
	core!: CoreConnectionChild
	public _observers: Array<any> = []
	public _devicePr: Promise<BaseRemoteDeviceIntegration<DeviceOptionsAny>>
	public _deviceId: string
	public _device!: BaseRemoteDeviceIntegration<DeviceOptionsAny>
	private _coreParentHandler: CoreHandler
	private _tsrHandler: TSRHandler
	private _subscriptions: Array<string> = []
	private _hasGottenStatusChange = false
	private _deviceStatus: PeripheralDeviceAPI.PeripheralDeviceStatusObject = {
		statusCode: StatusCode.BAD,
		messages: ['Starting up...'],
	}

	constructor(
		parent: CoreHandler,
		device: Promise<BaseRemoteDeviceIntegration<DeviceOptionsAny>>,
		deviceId: string,
		tsrHandler: TSRHandler
	) {
		this._coreParentHandler = parent
		this._devicePr = device
		this._deviceId = deviceId
		this._tsrHandler = tsrHandler
	}
	async init(): Promise<void> {
		this._device = await this._devicePr
		const deviceId = this._device.deviceId
		const deviceName = `${deviceId} (${this._device.deviceName})`

		this.core = await this._coreParentHandler.core.createChild({
			deviceId: protectString(this._coreParentHandler.core.deviceId + 'Playout' + deviceId),

			deviceName,

			deviceSubType: this._device.deviceOptions.type,
		})
		this.core.on('error', (err: any) => {
			this._coreParentHandler.logger.error(
				'Core Error: ' + ((_.isObject(err) && err.message) || err.toString() || err)
			)
		})

		if (!this._hasGottenStatusChange) {
			this._deviceStatus = await this._device.device.getStatus()
			this.sendStatus()
		}
		await this.setupSubscriptionsAndObservers()
		this._coreParentHandler.logger.debug('setupSubscriptionsAndObservers done')
	}
	async setupSubscriptionsAndObservers(): Promise<void> {
		// console.log('setupObservers', this.core.deviceId)
		if (this._observers.length) {
			this._coreParentHandler.logger.info('CoreTSRDevice: Clearing observers..')
			this._observers.forEach((obs) => {
				obs.stop()
			})
			this._observers = []
		}
		const deviceId = this._device.deviceId

		this._coreParentHandler.logger.info(
			'CoreTSRDevice: Setting up subscriptions for ' + this.core.deviceId + ' for device ' + deviceId + ' ..'
		)
		this._subscriptions = []
		try {
			const sub = await this.core.autoSubscribe('peripheralDeviceCommands', this.core.deviceId)
			this._subscriptions.push(sub)
		} catch (e) {
			this._coreParentHandler.logger.error(e)
		}

		this._coreParentHandler.logger.info('CoreTSRDevice: Setting up observers..')

		// setup observers
		this._coreParentHandler.setupObserverForPeripheralDeviceCommands(this)
	}
	statusChanged(deviceStatus: Partial<PeripheralDeviceAPI.PeripheralDeviceStatusObject>): void {
		this._hasGottenStatusChange = true

		this._deviceStatus = {
			...this._deviceStatus,
			...deviceStatus,
		}
		this.sendStatus()
	}
	/** Send the device status to Core */
	sendStatus(): void {
		if (!this.core) return // not initialized yet

		this.core.setStatus(this._deviceStatus).catch((e: any) =>
			this._coreParentHandler.logger.error(`Error when setting status: ${e}`, {
				error: e,
				stacktrace: e.stack,
			})
		)
	}
	onCommandError(
		_errorMessage: string,
		_ref: {
			rundownId?: string
			partId?: string
			pieceId?: string
			context: string
			timelineObjId: string
		}
	): void {
		// This is not implemented in Core
		// this.core
		// 		.callMethodLowPrio(PeripheralDeviceAPIMethods.reportCommandError, [errorMessage, ref])
		// 		.catch((e: any) =>
		// 			this._coreParentHandler.logger.error(`Error when callMethodLowPrio: ${e}`, {
		// 				error: e,
		// 				stacktrace: e.stack,
		// 			})
		// 		)
		// }
	}
	onUpdateMediaObject(collectionId: string, docId: string, doc: MediaObject | null): void {
		this.core.coreMethodsLowPriority.updateMediaObject(collectionId, docId, doc as any).catch((e: any) =>
			this._coreParentHandler.logger.error(`Error when updating Media Object: ${e}`, {
				error: e,
				stacktrace: e.stack,
			})
		)
	}
	onClearMediaObjectCollection(collectionId: string): void {
		this.core.coreMethodsLowPriority.clearMediaObjectCollection(collectionId).catch((e: any) =>
			this._coreParentHandler.logger.error(`Error when clearing Media Objects collection: ${e}`, {
				error: e,
				stacktrace: e.stack,
			})
		)
	}

	async dispose(): Promise<void> {
		this._observers.forEach((obs) => {
			obs.stop()
		})

		await this._tsrHandler.tsr.removeDevice(this._deviceId)
		await this.core.setStatus({
			statusCode: StatusCode.BAD,
			messages: ['Uninitialized'],
		})
	}
	killProcess(): void {
		this._coreParentHandler.killProcess()
	}
	async executeAction(actionId: string, payload?: Record<string, any>): Promise<ActionExecutionResult> {
		this._coreParentHandler.logger.info(`Exec ${actionId} on ${this._deviceId}`)
		const device = this._device.device

		return device.executeAction(actionId, payload)
	}
}
