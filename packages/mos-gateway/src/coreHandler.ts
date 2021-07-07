import {
	CoreConnection,
	CoreOptions,
	PeripheralDeviceAPI as P,
	DDPConnectorOptions,
} from '@sofie-automation/server-core-integration'
import * as Winston from 'winston'
import { Process } from './process'

import {
	IMOSConnectionStatus,
	IMOSDevice,
	IMOSListMachInfo,
	MosString128,
	MosTime,
	IMOSRunningOrder,
	IMOSRunningOrderBase,
	IMOSRunningOrderStatus,
	IMOSStoryStatus,
	IMOSItemStatus,
	IMOSStoryAction,
	IMOSROStory,
	IMOSROAction,
	IMOSItemAction,
	IMOSItem,
	IMOSROReadyToAir,
	IMOSROFullStory,
	MosDuration,
	IMOSObjectStatus,
	IMOSROAck,
} from 'mos-connection'

export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends Array<infer U>
		? Array<DeepPartial<U>>
		: T[P] extends ReadonlyArray<infer U>
		? ReadonlyArray<DeepPartial<U>>
		: DeepPartial<T[P]>
}

function deepMatch(object: any, attrs: any, deep: boolean): boolean {
	const keys = Object.keys(attrs)
	const length = keys.length
	if (object === null || object === undefined) return !length
	const obj = Object(object)
	for (let i = 0; i < length; i++) {
		const key = keys[i]
		if (deep && typeof attrs[key] === 'object') {
			if (!deepMatch(obj[key], attrs[key], true)) return false
		} else if (attrs[key] !== obj[key]) return false
	}
	return true
}

import { MosHandler } from './mosHandler'
import { DeviceConfig } from './connector'
import { MOS_DEVICE_CONFIG_MANIFEST } from './configManifest'
export interface PeripheralDeviceCommand {
	_id: string

	deviceId: string
	functionName: string
	args: Array<any>

	hasReply: boolean
	reply?: any
	replyError?: any

	time: number // time
}

export interface IStoryItemChange {
	roID: string
	storyID: string
	itemID: string
	timestamp: number

	resolve: (value?: IMOSROAck | PromiseLike<IMOSROAck> | undefined) => void
	reject: (error: any) => void

	itemDiff: DeepPartial<IMOSItem>
}

/**
 * Represents a connection between a mos-device and Core
 */
export class CoreMosDeviceHandler {
	core: CoreConnection
	public _observers: Array<any> = []
	public _mosDevice: IMOSDevice
	private _coreParentHandler: CoreHandler
	private _mosHandler: MosHandler
	private _subscriptions: Array<any> = []

	private _pendingStoryItemChanges: Array<IStoryItemChange> = []
	private readonly _pendingChangeTimeout: number = 60 * 1000

	constructor(parent: CoreHandler, mosDevice: IMOSDevice, mosHandler: MosHandler) {
		this._coreParentHandler = parent
		this._mosDevice = mosDevice
		this._mosHandler = mosHandler

		this._coreParentHandler.logger.info('new CoreMosDeviceHandler ' + mosDevice.idPrimary)
		this.core = new CoreConnection(parent.getCoreConnectionOptions(mosDevice.idPrimary, mosDevice.idPrimary, false))
		this.core.onError((err) => {
			this._coreParentHandler.logger.error('Core Error: ' + (err.message || err.toString() || err))
		})
	}
	async init(): Promise<void> {
		await this.core.init(this._coreParentHandler.core)
		await this.setupSubscriptionsAndObservers()
	}
	async setupSubscriptionsAndObservers(): Promise<void> {
		if (this._observers.length) {
			this._coreParentHandler.logger.info('CoreMos: Clearing observers..')
			this._observers.forEach((obs) => {
				obs.stop()
			})
			this._observers = []
		}
		this._coreParentHandler.logger.info(
			'CoreMos: Setting up subscriptions for ' +
				this.core.deviceId +
				' for mosDevice ' +
				this._mosDevice.idPrimary +
				' ..'
		)
		this._subscriptions = []
		const subs = await Promise.all([this.core.autoSubscribe('peripheralDeviceCommands', this.core.deviceId)])
		this._subscriptions = this._subscriptions.concat(subs)

		this._coreParentHandler.logger.info('CoreMos: Setting up observers..')

		// setup observers
		this._coreParentHandler.setupObserverForPeripheralDeviceCommands(this)
	}
	onMosConnectionChanged(connectionStatus: IMOSConnectionStatus): void {
		let statusCode: P.StatusCode
		const messages: Array<string> = []

		if (connectionStatus.PrimaryConnected) {
			if (connectionStatus.SecondaryConnected || !this._mosDevice.idSecondary) {
				statusCode = P.StatusCode.GOOD
			} else {
				statusCode = P.StatusCode.WARNING_MINOR
			}
		} else {
			if (connectionStatus.SecondaryConnected) {
				statusCode = P.StatusCode.WARNING_MAJOR
			} else {
				statusCode = P.StatusCode.BAD
			}
		}

		if (!connectionStatus.PrimaryConnected) {
			messages.push(connectionStatus.PrimaryStatus || 'Primary not connected')
		}
		if (this._mosDevice.idSecondary && !connectionStatus.SecondaryConnected) {
			messages.push(connectionStatus.SecondaryStatus || 'Fallback not connected')
		}

		this.core
			.setStatus({
				statusCode: statusCode,
				messages: messages,
			})
			.catch((e) => this._coreParentHandler.logger.warn('Error when setting status:' + e))
	}
	getMachineInfo(): Promise<IMOSListMachInfo> {
		const info: IMOSListMachInfo = {
			manufacturer: new MosString128('SuperFly.tv'),
			model: new MosString128('Core'),
			hwRev: new MosString128('0'),
			swRev: new MosString128('0'),
			DOM: new MosTime('2018-01-01'),
			SN: new MosString128('0000'),
			ID: new MosString128('0000'),
			time: new MosTime(new Date()),
			mosRev: new MosString128('0'),
			supportedProfiles: {
				deviceType: 'MOS', // MOS, NCS
				profile0: this._mosHandler.mosOptions.self.profiles['0'],
				profile1: this._mosHandler.mosOptions.self.profiles['1'],
				profile2: this._mosHandler.mosOptions.self.profiles['2'],
				profile3: this._mosHandler.mosOptions.self.profiles['3'],
				profile4: this._mosHandler.mosOptions.self.profiles['4'],
				profile5: this._mosHandler.mosOptions.self.profiles['5'],
				profile6: this._mosHandler.mosOptions.self.profiles['6'],
				profile7: this._mosHandler.mosOptions.self.profiles['7'],
			},
		}
		return Promise.resolve(info)
	}
	mosRoCreate(ro: IMOSRunningOrder): Promise<any> {
		return this._coreMosManipulate(P.methods.mosRoCreate, ro)
	}
	mosRoReplace(ro: IMOSRunningOrder): Promise<any> {
		return this._coreMosManipulate(P.methods.mosRoReplace, ro)
	}
	mosRoDelete(runningOrderId: MosString128): Promise<any> {
		return this._coreMosManipulate(P.methods.mosRoDelete, runningOrderId)
	}
	mosRoMetadata(metadata: IMOSRunningOrderBase): Promise<any> {
		return this._coreMosManipulate(P.methods.mosRoMetadata, metadata)
	}
	mosRoStatus(status: IMOSRunningOrderStatus): Promise<any> {
		return this._coreMosManipulate(P.methods.mosRoStatus, status)
	}
	mosRoStoryStatus(status: IMOSStoryStatus): Promise<any> {
		return this._coreMosManipulate(P.methods.mosRoStoryStatus, status)
	}
	mosRoItemStatus(status: IMOSItemStatus): Promise<any> {
		return this._coreMosManipulate(P.methods.mosRoItemStatus, status)
	}
	mosRoStoryInsert(Action: IMOSStoryAction, Stories: Array<IMOSROStory>): Promise<any> {
		return this._coreMosManipulate(P.methods.mosRoStoryInsert, Action, Stories)
	}
	mosRoStoryReplace(Action: IMOSStoryAction, Stories: Array<IMOSROStory>): Promise<any> {
		const result = this._coreMosManipulate(P.methods.mosRoStoryReplace, Action, Stories)

		if (this._pendingStoryItemChanges.length > 0) {
			Stories.forEach((story) => {
				const pendingChange = this._pendingStoryItemChanges.find(
					(change) => change.storyID === story.ID.toString()
				)
				if (pendingChange) {
					const pendingChangeItem = story.Items.find((item) => pendingChange.itemID === item.ID.toString())
					if (pendingChangeItem && deepMatch(pendingChangeItem, pendingChange.itemDiff, true)) {
						pendingChange.resolve()
					}
				}
			})
		}
		return result
	}
	mosRoStoryMove(Action: IMOSStoryAction, Stories: Array<MosString128>): Promise<any> {
		return this._coreMosManipulate(P.methods.mosRoStoryMove, Action, Stories)
	}
	mosRoStoryDelete(Action: IMOSROAction, Stories: Array<MosString128>): Promise<any> {
		return this._coreMosManipulate(P.methods.mosRoStoryDelete, Action, Stories)
	}
	mosRoStorySwap(Action: IMOSROAction, StoryID0: MosString128, StoryID1: MosString128): Promise<any> {
		return this._coreMosManipulate(P.methods.mosRoStorySwap, Action, StoryID0, StoryID1)
	}
	mosRoItemInsert(Action: IMOSItemAction, Items: Array<IMOSItem>): Promise<any> {
		return this._coreMosManipulate(P.methods.mosRoItemInsert, Action, Items)
	}
	mosRoItemReplace(Action: IMOSItemAction, Items: Array<IMOSItem>): Promise<any> {
		const result = this._coreMosManipulate(P.methods.mosRoItemReplace, Action, Items)

		if (this._pendingStoryItemChanges.length > 0) {
			Items.forEach((item) => {
				const pendingChange = this._pendingStoryItemChanges.find(
					(change) => Action.StoryID.toString() === change.storyID && change.itemID === item.ID.toString()
				)
				if (pendingChange && deepMatch(item, pendingChange.itemDiff, true)) {
					pendingChange.resolve()
				}
			})
		}

		return result
	}
	mosRoItemMove(Action: IMOSItemAction, Items: Array<MosString128>): Promise<any> {
		return this._coreMosManipulate(P.methods.mosRoItemMove, Action, Items)
	}
	mosRoItemDelete(Action: IMOSStoryAction, Items: Array<MosString128>): Promise<any> {
		return this._coreMosManipulate(P.methods.mosRoItemDelete, Action, Items)
	}
	mosRoItemSwap(Action: IMOSStoryAction, ItemID0: MosString128, ItemID1: MosString128): Promise<any> {
		return this._coreMosManipulate(P.methods.mosRoItemSwap, Action, ItemID0, ItemID1)
	}
	mosRoReadyToAir(Action: IMOSROReadyToAir): Promise<any> {
		return this._coreMosManipulate(P.methods.mosRoReadyToAir, Action)
	}
	mosRoFullStory(story: IMOSROFullStory): Promise<any> {
		const result = this._coreMosManipulate(P.methods.mosRoFullStory, story)

		if (this._pendingStoryItemChanges.length > 0) {
			const pendingChange = this._pendingStoryItemChanges.find((change) => change.storyID === story.ID.toString())
			if (pendingChange) {
				const pendingChangeItem = story.Body.find(
					(item) => item.Type === 'storyItem' && pendingChange.itemID === item.Content.ID.toString()
				)
				if (pendingChangeItem && deepMatch(pendingChangeItem.Content, pendingChange.itemDiff, true)) {
					pendingChange.resolve()
				}
			}
		}

		return result
	}

	async triggerGetAllRunningOrders(): Promise<any> {
		return this.fixMosData(await this._mosDevice.sendRequestAllRunningOrders())
	}
	async triggerGetRunningOrder(roId: string): Promise<any> {
		return this.fixMosData(await this._mosDevice.sendRequestRunningOrder(new MosString128(roId)))
	}
	async setROStatus(roId: string, status: IMOSObjectStatus): Promise<any> {
		return this.fixMosData(
			await this._mosDevice.sendRunningOrderStatus({
				ID: new MosString128(roId),
				Status: status,
				Time: new MosTime(),
			})
		)
	}
	async setStoryStatus(roId: string, storyId: string, status: IMOSObjectStatus): Promise<any> {
		return this.fixMosData(
			await this._mosDevice.sendStoryStatus({
				RunningOrderId: new MosString128(roId),
				ID: new MosString128(storyId),
				Status: status,
				Time: new MosTime(),
			})
		)
	}
	async setItemStatus(roId: string, storyId: string, itemId: string, status: IMOSObjectStatus): Promise<any> {
		return this.fixMosData(
			await this._mosDevice.sendItemStatus({
				RunningOrderId: new MosString128(roId),
				StoryId: new MosString128(storyId),
				ID: new MosString128(itemId),
				Status: status,
				Time: new MosTime(),
			})
		)
	}
	async replaceStoryItem(
		roID: string,
		storyID: string,
		item: IMOSItem,
		itemDiff?: DeepPartial<IMOSItem>
	): Promise<any> {
		const result = this.fixMosData(
			await this._mosDevice.sendItemReplace({
				roID: new MosString128(roID),
				storyID: new MosString128(storyID),
				item,
			})
		)

		if (!itemDiff) {
			return result
		} else {
			if (
				!result ||
				!result.mos ||
				!result.mos.roAck ||
				!result.mos.roAck.roStatus ||
				result.mos.roAck.roStatus.toString() !== 'OK'
			) {
				return Promise.reject(result)
			} else {
				// When the result of the replaceStoryItem operation comes in,
				// it is not confirmed if the change actually was performed or not.
				// Therefore we put a "pendingChange" on watch, so that this operation does not resolve
				// until the change actually has been applied (using onStoryReplace, onItemReplace or onFullStory)

				const pendingChange: IStoryItemChange = {
					roID,
					storyID,
					itemID: item.ID.toString(),
					timestamp: Date.now(),

					resolve: () => {
						return
					},
					reject: () => {
						return
					},

					itemDiff,
				}
				this._coreParentHandler.logger.debug(
					`creating pending change: ${pendingChange.storyID}:${pendingChange.itemID}`
				)
				const promise = new Promise<IMOSROAck>((promiseResolve, promiseReject) => {
					pendingChange.resolve = (value) => {
						this.removePendingChange(pendingChange)
						this._coreParentHandler.logger.debug(
							`pending change resolved: ${pendingChange.storyID}:${pendingChange.itemID}`
						)
						promiseResolve(value || result)
					}
					pendingChange.reject = (reason) => {
						this.removePendingChange(pendingChange)
						this._coreParentHandler.logger.debug(
							`pending change rejected: ${pendingChange.storyID}:${pendingChange.itemID}`
						)
						promiseReject(reason)
					}
				})
				this.addPendingChange(pendingChange)
				setTimeout(() => {
					pendingChange.reject('Pending change timed out')
				}, this._pendingChangeTimeout)
				return promise
			}
		}
	}
	test(a: string): Promise<string> {
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve('test' + a)
			}, 2000)
		})
	}
	async dispose(): Promise<void> {
		this._observers.forEach((obs) => {
			obs.stop()
		})

		await this.core.setStatus({
			statusCode: P.StatusCode.BAD,
			messages: ['Uninitialized'],
		})
	}
	killProcess(actually: number): boolean {
		return this._coreParentHandler.killProcess(actually)
	}
	/**
	 * Convert mos-objects to look better over the wire
	 * @param o the object to convert
	 */
	private fixMosData(o: any): any {
		if (typeof o === 'object' && (o instanceof MosTime || o instanceof MosDuration || o instanceof MosString128)) {
			return o.toString()
		}
		if (Array.isArray(o)) {
			return o.map((val) => {
				return this.fixMosData(val)
			})
		} else if (typeof o === 'object') {
			const o2: any = {}
			for (const [key, val] of Object.entries(o)) {
				o2[key] = this.fixMosData(val)
			}
			return o2
		} else {
			return o
		}
	}
	private _coreMosManipulate(method: string, ...attrs: Array<any>): Promise<any> {
		attrs = attrs.map((attr) => {
			return this.fixMosData(attr)
		})
		// Make the commands be sent sequantially:
		return this.core.putOnQueue('mos', () => {
			// Log info about the sent command:
			let msg = 'Command: ' + method
			const attr0 = attrs[0]
			if (attr0) {
				if (attr0.ID) msg = `${method}: ${attr0.ID}`
				else if (attr0 instanceof MosString128) msg = `${method}: ${attr0.toString()}`
				else if (attr0.ObjectId) msg = `${method}: ${attr0.ObjectId}`
				else if (attr0.StoryId) msg = `${method}: ${attr0.StoryId}`
				else if (attr0.StoryID) msg = `${method}: ${attr0.StoryID}`
				else if (attr0.ItemID) msg = `${method}: ${attr0.ItemID}`
				else if (attr0.RunningOrderID) msg = `${method}: ${attr0.RunningOrderID}`
				else if (attr0.toString) msg = `${method}: ${attr0.toString()}`
			}

			this._coreParentHandler.logger.info('Recieved MOS command: ' + msg)

			return this.core.mosManipulate(method, ...attrs).catch((e) => {
				this._coreParentHandler.logger.info('MOS command rejected: ' + ((e && JSON.stringify(e)) || e))
				throw e
			})
		})
	}
	private addPendingChange(change: IStoryItemChange) {
		this._pendingStoryItemChanges.push(change)
	}
	private removePendingChange(change: IStoryItemChange) {
		const idx = this._pendingStoryItemChanges.indexOf(change)
		if (idx >= 0) {
			this._pendingStoryItemChanges.splice(idx, 1)
		}
	}
}
export interface CoreConfig {
	host: string
	port: number
	watchdog: boolean
}
/**
 * Represents a connection between mos-integration and Core
 */
export class CoreHandler {
	core: CoreConnection
	logger: Winston.LoggerInstance
	public _observers: Array<any> = []
	private _deviceOptions: DeviceConfig
	private _coreMosHandlers: Array<CoreMosDeviceHandler> = []
	private _onConnected?: () => any
	private _subscriptions: Array<any> = []
	private _isInitialized = false
	private _executedFunctions: { [id: string]: boolean } = {}
	private _coreConfig?: CoreConfig
	private _process?: Process

	constructor(logger: Winston.LoggerInstance, deviceOptions: DeviceConfig) {
		this.logger = logger
		this._deviceOptions = deviceOptions
	}

	async init(config: CoreConfig, process: Process): Promise<void> {
		// this.logger.info('========')
		this._coreConfig = config
		this._process = process
		this.core = new CoreConnection(this.getCoreConnectionOptions('MOS gateway', 'MosCoreParent', true))

		this.core.onConnected(() => {
			this.logger.info('Core Connected!')
			if (this._isInitialized) this.onConnectionRestored()
		})
		this.core.onDisconnected(() => {
			this.logger.info('Core Disconnected!')
		})
		this.core.onError((err) => {
			this.logger.error('Core Error: ' + (err.message || err.toString() || err))
		})

		const ddpConfig: DDPConnectorOptions = {
			host: config.host,
			port: config.port,
		}
		if (this._process && this._process.certificates.length) {
			ddpConfig.tlsOpts = {
				ca: this._process.certificates,
			}
		}
		await this.core.init(ddpConfig)

		await this.core.setStatus({
			statusCode: P.StatusCode.GOOD,
			// messages: []
		})

		await this.setupSubscriptionsAndObservers()

		this._isInitialized = true
	}
	async dispose(reason?: string): Promise<void> {
		await this.core.setStatus({
			statusCode: P.StatusCode.FATAL,
			messages: [reason || 'Shutting down'],
		})
		await Promise.all(
			this._coreMosHandlers.map((cmh: CoreMosDeviceHandler) => {
				return cmh.dispose()
			})
		)
		await this.core.destroy()
	}
	getCoreConnectionOptions(name: string, subDeviceId: string, parentProcess: boolean): CoreOptions {
		let credentials: {
			deviceId: string
			deviceToken: string
		}

		if (this._deviceOptions.deviceId && this._deviceOptions.deviceToken) {
			credentials = {
				deviceId: this._deviceOptions.deviceId + subDeviceId,
				deviceToken: this._deviceOptions.deviceToken,
			}
		} else if (this._deviceOptions.deviceId) {
			this.logger.warn('Token not set, only id! This might be unsecure!')
			credentials = {
				deviceId: this._deviceOptions.deviceId + subDeviceId,
				deviceToken: 'unsecureToken',
			}
		} else {
			credentials = CoreConnection.getCredentials(subDeviceId)
		}
		const options: CoreOptions = {
			...credentials,

			deviceCategory: P.DeviceCategory.INGEST,
			deviceType: P.DeviceType.MOS, // @todo: should not have this...
			deviceSubType: parentProcess ? P.SUBTYPE_PROCESS : 'mos_connection',

			deviceName: name,
			watchDog: this._coreConfig ? this._coreConfig.watchdog : true,

			configManifest: MOS_DEVICE_CONFIG_MANIFEST,
		}
		if (parentProcess) options.versions = this._getVersions()
		return options
	}
	async registerMosDevice(mosDevice: IMOSDevice, mosHandler: MosHandler): Promise<CoreMosDeviceHandler> {
		this.logger.info('registerMosDevice -------------')
		const coreMos = new CoreMosDeviceHandler(this, mosDevice, mosHandler)

		this._coreMosHandlers.push(coreMos)
		await coreMos.init()

		this.logger.info('registerMosDevice done!')
		return coreMos
	}
	async unRegisterMosDevice(mosDevice: IMOSDevice): Promise<void> {
		const index = this._coreMosHandlers.findIndex((o) => o._mosDevice.idPrimary === mosDevice.idSecondary)

		const coreMosHandler = this._coreMosHandlers[index]
		if (coreMosHandler) {
			await coreMosHandler.dispose()
			this._coreMosHandlers.splice(index, 1)
		}
	}
	onConnectionRestored(): void {
		this.setupSubscriptionsAndObservers().catch((e) => {
			this.logger.error(e)
		})
		if (this._onConnected) this._onConnected()

		for (const cmh of this._coreMosHandlers) {
			cmh.setupSubscriptionsAndObservers().catch((e) => {
				this.logger.error('Error in setupSubscriptionsAndObservers')
				this.logger.error(e)
			})
		}
	}
	onConnected(fcn: () => any): void {
		this._onConnected = fcn
	}
	async setupSubscriptionsAndObservers(): Promise<void> {
		if (this._observers.length) {
			this.logger.info('Core: Clearing observers..')
			this._observers.forEach((obs) => {
				obs.stop()
			})
			this._observers = []
		}
		this._subscriptions = []

		this.logger.info('Core: Setting up subscriptions for ' + this.core.deviceId + '..')
		const subs = await Promise.all([
			this.core.autoSubscribe('peripheralDevices', {
				_id: this.core.deviceId,
			}),
			this.core.autoSubscribe('peripheralDeviceCommands', this.core.deviceId),
		])
		this._subscriptions = this._subscriptions.concat(subs)

		this.setupObserverForPeripheralDeviceCommands(this)
	}
	setStatus(statusCode: P.StatusCode, messages: Array<string> = []): void {
		this.core
			.setStatus({
				statusCode: statusCode,
				messages: messages,
			})
			.catch((e) => this.logger.warn('Error when setting status:' + e.toString()))
	}
	executeFunction(cmd: PeripheralDeviceCommand, fcnObject: CoreHandler | CoreMosDeviceHandler): void {
		if (cmd) {
			if (this._executedFunctions[cmd._id]) return // prevent it from running multiple times
			this.logger.debug(cmd.functionName, cmd.args)
			this._executedFunctions[cmd._id] = true
			const cb = (err: any, res?: any): void => {
				if (err) {
					this.logger.error('executeFunction error', err, err.stack)
				}
				fcnObject.core.callMethod(P.methods.functionReply, [cmd._id, err, res]).catch((e) => {
					this.logger.error(e)
				})
			}
			// @ts-expect-error index missing
			const fcn: (...args: any[]) => any | undefined = fcnObject[cmd.functionName]
			try {
				if (!fcn) throw Error('Function "' + cmd.functionName + '" not found!')

				Promise.resolve(fcn.apply(fcnObject, cmd.args))
					.then((result) => {
						cb(null, result)
					})
					.catch((e) => {
						cb(e.toString(), null)
					})
			} catch (e) {
				cb(e.toString(), null)
			}
		}
	}
	retireExecuteFunction(cmdId: string): void {
		delete this._executedFunctions[cmdId]
	}
	setupObserverForPeripheralDeviceCommands(functionObject: CoreMosDeviceHandler | CoreHandler): void {
		const observer = functionObject.core.observe('peripheralDeviceCommands')
		functionObject.killProcess(0) // just make sure it exists
		functionObject._observers.push(observer)
		const addedChangedCommand = (id: string) => {
			const cmds = functionObject.core.getCollection('peripheralDeviceCommands')
			if (!cmds) throw Error('"peripheralDeviceCommands" collection not found!')
			const cmd = cmds.findOne(id) as PeripheralDeviceCommand
			if (!cmd) throw Error('PeripheralCommand "' + id + '" not found!')
			if (cmd.deviceId === functionObject.core.deviceId) {
				this.executeFunction(cmd, functionObject)
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
		const cmds = functionObject.core.getCollection('peripheralDeviceCommands')
		if (!cmds) throw Error('"peripheralDeviceCommands" collection not found!')
		cmds.find({}).forEach((cmd: PeripheralDeviceCommand) => {
			if (cmd.deviceId === functionObject.core.deviceId) {
				this.executeFunction(cmd, functionObject)
			}
		})
	}
	killProcess(actually: number): boolean {
		if (actually === 1) {
			this.logger.info('KillProcess command received, shutting down in 1000ms!')
			setTimeout(() => {
				// eslint-disable-next-line no-process-exit
				process.exit(0)
			}, 1000)
			return true
		}
		return false
	}
	pingResponse(message: string): boolean {
		this.core.setPingResponse(message)
		return true
	}
	getSnapshot(): any {
		this.logger.info('getSnapshot')
		return {} // TODO: send some snapshot data?
	}
	private _getVersions(): { [packageName: string]: string } {
		const versions: { [packageName: string]: string } = {}

		if (process.env.npm_package_version) {
			versions['_process'] = process.env.npm_package_version
		}

		const pkgNames = ['mos-connection']
		try {
			for (const pkgName of pkgNames) {
				try {
					// eslint-disable-next-line @typescript-eslint/no-var-requires
					const pkgInfo = require(`${pkgName}/package.json`)
					versions[pkgName] = pkgInfo.version || 'N/A'
				} catch (e) {
					this.logger.error(`Failed to load package.json for lib "${pkgName}": ${e}`)
				}
			}
		} catch (e) {
			this.logger.error(e)
		}
		return versions
	}
}
