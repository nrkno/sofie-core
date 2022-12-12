import { CoreConnection, CoreOptions, DDPConnectorOptions } from '@sofie-automation/server-core-integration'
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
import * as _ from 'underscore'
import { MosHandler } from './mosHandler'
import { DeviceConfig } from './connector'
import { MOS_DEVICE_CONFIG_MANIFEST } from './configManifest'
import { protectString, unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { StatusCode } from '@sofie-automation/shared-lib/dist/lib/status'
import {
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	PERIPHERAL_SUBTYPE_PROCESS,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { PartialDeep } from 'type-fest'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { PeripheralDeviceCommand } from '@sofie-automation/shared-lib/dist/core/model/PeripheralDeviceCommand'
import { ExternalPeripheralDeviceAPI } from '@sofie-automation/server-core-integration/dist/lib/methods'

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

export interface IStoryItemChange {
	roID: string
	storyID: string
	itemID: string
	timestamp: number

	resolve: (value?: IMOSROAck | PromiseLike<IMOSROAck> | undefined) => void
	reject: (error: any) => void

	itemDiff: PartialDeep<IMOSItem>
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
	private _pendingChangeTimeout: number = 60 * 1000

	constructor(parent: CoreHandler, mosDevice: IMOSDevice, mosHandler: MosHandler) {
		this._coreParentHandler = parent
		this._mosDevice = mosDevice
		this._mosHandler = mosHandler

		this._coreParentHandler.logger.info('new CoreMosDeviceHandler ' + mosDevice.idPrimary)
		this.core = new CoreConnection(parent.getCoreConnectionOptions(mosDevice.idPrimary, mosDevice.idPrimary, false))
		this.core.onError((err) => {
			this._coreParentHandler.logger.error(
				'Core Error: ' + (typeof err === 'string' ? err : err.message || err.toString())
			)
		})
	}
	async init(): Promise<void> {
		return this.core
			.init(this._coreParentHandler.core)
			.then(() => {
				return this.setupSubscriptionsAndObservers()
			})
			.then(() => {
				return
			})
	}
	setupSubscriptionsAndObservers(): void {
		// console.log('setupObservers', this.core.deviceId)
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
		Promise.all([this.core.autoSubscribe('peripheralDeviceCommands', this.core.deviceId)])
			.then((subs) => {
				this._subscriptions = this._subscriptions.concat(subs)
			})
			.then(() => {
				return
			})
			.catch((e) => {
				this._coreParentHandler.logger.error(e)
			})

		this._coreParentHandler.logger.info('CoreMos: Setting up observers..')

		// setup observers
		this._coreParentHandler.setupObserverForPeripheralDeviceCommands(this)
	}
	onMosConnectionChanged(connectionStatus: IMOSConnectionStatus): void {
		let statusCode: StatusCode
		const messages: Array<string> = []

		if (connectionStatus.PrimaryConnected) {
			if (connectionStatus.SecondaryConnected || !this._mosDevice.idSecondary) {
				statusCode = StatusCode.GOOD
			} else {
				statusCode = StatusCode.WARNING_MINOR
			}
		} else {
			if (connectionStatus.SecondaryConnected) {
				statusCode = StatusCode.WARNING_MAJOR
			} else {
				statusCode = StatusCode.BAD
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
	async getMachineInfo(): Promise<IMOSListMachInfo> {
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
				profile0: this._mosHandler?.mosOptions?.self.profiles['0'],
				profile1: this._mosHandler?.mosOptions?.self.profiles['1'],
				profile2: this._mosHandler?.mosOptions?.self.profiles['2'],
				profile3: this._mosHandler?.mosOptions?.self.profiles['3'],
				profile4: this._mosHandler?.mosOptions?.self.profiles['4'],
				profile5: this._mosHandler?.mosOptions?.self.profiles['5'],
				profile6: this._mosHandler?.mosOptions?.self.profiles['6'],
				profile7: this._mosHandler?.mosOptions?.self.profiles['7'],
			},
		}
		return Promise.resolve(info)
	}
	async mosRoCreate(ro: IMOSRunningOrder): Promise<void> {
		return this._coreMosManipulate('mosRoCreate', ro)
	}
	async mosRoReplace(ro: IMOSRunningOrder): Promise<void> {
		return this._coreMosManipulate('mosRoReplace', ro)
	}
	async mosRoDelete(runningOrderId: MosString128): Promise<void> {
		return this._coreMosManipulate('mosRoDelete', runningOrderId)
	}
	async mosRoMetadata(metadata: IMOSRunningOrderBase): Promise<void> {
		return this._coreMosManipulate('mosRoMetadata', metadata)
	}
	async mosRoStatus(status: IMOSRunningOrderStatus): Promise<void> {
		return this._coreMosManipulate('mosRoStatus', status)
	}
	async mosRoStoryStatus(status: IMOSStoryStatus): Promise<void> {
		return this._coreMosManipulate('mosRoStoryStatus', status)
	}
	async mosRoItemStatus(status: IMOSItemStatus): Promise<void> {
		return this._coreMosManipulate('mosRoItemStatus', status)
	}
	async mosRoStoryInsert(Action: IMOSStoryAction, Stories: Array<IMOSROStory>): Promise<void> {
		return this._coreMosManipulate('mosRoStoryInsert', Action, Stories)
	}
	async mosRoStoryReplace(Action: IMOSStoryAction, Stories: Array<IMOSROStory>): Promise<void> {
		const result = this._coreMosManipulate('mosRoStoryReplace', Action, Stories)

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
	async mosRoStoryMove(Action: IMOSStoryAction, Stories: Array<MosString128>): Promise<void> {
		return this._coreMosManipulate('mosRoStoryMove', Action, Stories)
	}
	async mosRoStoryDelete(Action: IMOSROAction, Stories: Array<MosString128>): Promise<void> {
		return this._coreMosManipulate('mosRoStoryDelete', Action, Stories)
	}
	async mosRoStorySwap(Action: IMOSROAction, StoryID0: MosString128, StoryID1: MosString128): Promise<void> {
		return this._coreMosManipulate('mosRoStorySwap', Action, StoryID0, StoryID1)
	}
	async mosRoItemInsert(Action: IMOSItemAction, Items: Array<IMOSItem>): Promise<void> {
		return this._coreMosManipulate('mosRoItemInsert', Action, Items)
	}
	async mosRoItemReplace(Action: IMOSItemAction, Items: Array<IMOSItem>): Promise<void> {
		const result = this._coreMosManipulate('mosRoItemReplace', Action, Items)

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
	async mosRoItemMove(Action: IMOSItemAction, Items: Array<MosString128>): Promise<void> {
		return this._coreMosManipulate('mosRoItemMove', Action, Items)
	}
	async mosRoItemDelete(Action: IMOSStoryAction, Items: Array<MosString128>): Promise<void> {
		return this._coreMosManipulate('mosRoItemDelete', Action, Items)
	}
	async mosRoItemSwap(Action: IMOSStoryAction, ItemID0: MosString128, ItemID1: MosString128): Promise<void> {
		return this._coreMosManipulate('mosRoItemSwap', Action, ItemID0, ItemID1)
	}
	async mosRoReadyToAir(Action: IMOSROReadyToAir): Promise<void> {
		return this._coreMosManipulate('mosRoReadyToAir', Action)
	}
	async mosRoFullStory(story: IMOSROFullStory): Promise<void> {
		const result = this._coreMosManipulate('mosRoFullStory', story)

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
		// console.log('triggerGetAllRunningOrders')
		return this._mosDevice
			.sendRequestAllRunningOrders()
			.then((results) => {
				// console.log('GOT REPLY', results)
				return this.fixMosData(results)
			})
			.catch((err: Error) => {
				// console.log('GOT ERR', err)
				throw err
			})
	}
	async triggerGetRunningOrder(roId: string): Promise<any> {
		// console.log('triggerGetRunningOrder ' + roId)
		return this._mosDevice
			.sendRequestRunningOrder(new MosString128(roId))
			.then((ro) => {
				// console.log('GOT REPLY', results)
				return this.fixMosData(ro)
			})
			.catch((err) => {
				// console.log('GOT ERR', err)
				throw err
			})
	}
	async setROStatus(roId: string, status: IMOSObjectStatus): Promise<any> {
		// console.log('setStoryStatus')
		return this._mosDevice
			.sendRunningOrderStatus({
				ID: new MosString128(roId),
				Status: status,
				Time: new MosTime(),
			})
			.then((result) => {
				// console.log('got result', result)
				return this.fixMosData(result)
			})
	}
	async setStoryStatus(roId: string, storyId: string, status: IMOSObjectStatus): Promise<any> {
		// console.log('setStoryStatus')
		return this._mosDevice
			.sendStoryStatus({
				RunningOrderId: new MosString128(roId),
				ID: new MosString128(storyId),
				Status: status,
				Time: new MosTime(),
			})
			.then((result) => {
				// console.log('got result', result)
				return this.fixMosData(result)
			})
	}
	async setItemStatus(roId: string, storyId: string, itemId: string, status: IMOSObjectStatus): Promise<any> {
		// console.log('setStoryStatus')
		return this._mosDevice
			.sendItemStatus({
				RunningOrderId: new MosString128(roId),
				StoryId: new MosString128(storyId),
				ID: new MosString128(itemId),
				Status: status,
				Time: new MosTime(),
			})
			.then((result) => {
				// console.log('got result', result)
				return this.fixMosData(result)
			})
	}
	async replaceStoryItem(
		roID: string,
		storyID: string,
		item: IMOSItem,
		itemDiff?: PartialDeep<IMOSItem>
	): Promise<any> {
		// console.log(roID, storyID, item)
		return this._mosDevice
			.sendItemReplace({
				roID: new MosString128(roID),
				storyID: new MosString128(storyID),
				item,
			})
			.then((result) => this.fixMosData(result))
			.then((result: any) => {
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
			})
	}
	async test(a: string): Promise<string> {
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

		return this.core
			.setStatus({
				statusCode: StatusCode.BAD,
				messages: ['Uninitialized'],
			})
			.then(() => {
				return
			})
	}
	killProcess(actually: number): true | 0 {
		return this._coreParentHandler.killProcess(actually)
	}
	/**
	 * Convert mos-objects to look better over the wire
	 * @param o the object to convert
	 */
	private fixMosData(o: any): any {
		if (_.isObject(o) && (o instanceof MosTime || o instanceof MosDuration || o instanceof MosString128)) {
			return o.toString()
		}
		if (_.isArray(o)) {
			return _.map(o, (val) => {
				return this.fixMosData(val)
			})
		} else if (_.isObject(o)) {
			const o2: any = {}
			_.each(o, (val, key) => {
				o2[key] = this.fixMosData(val)
			})
			return o2
		} else {
			return o
		}
	}
	private async _coreMosManipulate<K extends keyof ExternalPeripheralDeviceAPI>(
		methodName: K,
		...attrs: Parameters<ExternalPeripheralDeviceAPI[K]>
	): Promise<ReturnType<ExternalPeripheralDeviceAPI[K]>> {
		attrs = _.map(attrs, (attr) => {
			return this.fixMosData(attr)
		}) as any

		// Make the commands be sent sequantially:
		return this.core.putOnQueue('mos', async () => {
			// Log info about the sent command:
			let msg = 'Command: ' + methodName
			if (attrs[0] && attrs[0].ID) msg = `${methodName}: ${attrs[0].ID}`
			else if (attrs[0] && attrs[0] instanceof MosString128) msg = `${methodName}: ${attrs[0].toString()}`
			else if (attrs[0] && attrs[0].ObjectId) msg = `${methodName}: ${attrs[0].ObjectId}`
			else if (attrs[0] && attrs[0].StoryId) msg = `${methodName}: ${attrs[0].StoryId}`
			else if (attrs[0] && attrs[0].StoryID) msg = `${methodName}: ${attrs[0].StoryID}`
			else if (attrs[0] && attrs[0].ItemID) msg = `${methodName}: ${attrs[0].ItemID}`
			else if (attrs[0] && attrs[0].RunningOrderID) msg = `${methodName}: ${attrs[0].RunningOrderID}`
			else if (attrs[0] && attrs[0].toString) msg = `${methodName}: ${attrs[0].toString()}`

			this._coreParentHandler.logger.info('Recieved MOS command: ' + msg)

			const res = (this.core.coreMethods[methodName] as any)(...attrs)
			return res.catch((e: any) => {
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
	core: CoreConnection | undefined
	logger: Winston.Logger
	public _observers: Array<any> = []
	private _deviceOptions: DeviceConfig
	private _coreMosHandlers: Array<CoreMosDeviceHandler> = []
	private _onConnected?: () => any
	private _subscriptions: Array<any> = []
	private _isInitialized = false
	private _executedFunctions: { [id: string]: boolean } = {}
	private _coreConfig?: CoreConfig
	private _process?: Process

	constructor(logger: Winston.Logger, deviceOptions: DeviceConfig) {
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
			this.logger.error('Core Error: ' + (typeof err === 'string' ? err : err.message || err.toString()))
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
		return this.core
			.init(ddpConfig)
			.then((_id: PeripheralDeviceId) => {
				if (!this.core) {
					throw Error('core is undefined!')
				}

				this.core
					.setStatus({
						statusCode: StatusCode.GOOD,
						// messages: []
					})
					.catch((e) => this.logger.warn('Error when setting status:' + e))
				// nothing
			})
			.then(async () => {
				return this.setupSubscriptionsAndObservers()
			})
			.then(() => {
				this._isInitialized = true
			})
	}
	async dispose(): Promise<void> {
		if (!this.core) {
			throw Error('core is undefined!')
		}

		return this.core
			.setStatus({
				statusCode: StatusCode.FATAL,
				messages: ['Shutting down'],
			})
			.then(async () => {
				return Promise.all(
					this._coreMosHandlers.map(async (cmh: CoreMosDeviceHandler) => {
						return cmh.dispose()
					})
				)
			})
			.then(async () => {
				if (!this.core) {
					throw Error('core is undefined!')
				}
				return this.core.destroy()
			})
			.then(() => {
				// nothing
			})
	}
	getCoreConnectionOptions(name: string, subDeviceId: string, parentProcess: boolean): CoreOptions {
		if (!this._deviceOptions.deviceId) {
			// this.logger.warn('DeviceId not set, using a temporary random id!')
			throw new Error('DeviceId is not set!')
		}

		const options: CoreOptions = {
			deviceId: protectString(this._deviceOptions.deviceId + subDeviceId),
			deviceToken: this._deviceOptions.deviceToken,

			deviceCategory: PeripheralDeviceCategory.INGEST,
			deviceType: PeripheralDeviceType.MOS, // @todo: should not have this...
			deviceSubType: parentProcess ? PERIPHERAL_SUBTYPE_PROCESS : 'mos_connection',

			deviceName: name,
			watchDog: this._coreConfig ? this._coreConfig.watchdog : true,

			configManifest: MOS_DEVICE_CONFIG_MANIFEST,
		}

		if (!options.deviceToken) {
			this.logger.warn('Token not set, only id! This might be unsecure!')
			options.deviceToken = 'unsecureToken'
		}

		if (parentProcess) options.versions = this._getVersions()
		return options
	}
	async registerMosDevice(mosDevice: IMOSDevice, mosHandler: MosHandler): Promise<CoreMosDeviceHandler> {
		this.logger.info('registerMosDevice -------------')
		const coreMos = new CoreMosDeviceHandler(this, mosDevice, mosHandler)

		this._coreMosHandlers.push(coreMos)
		return coreMos.init().then(() => {
			this.logger.info('registerMosDevice done!')
			return coreMos
		})
	}
	async unRegisterMosDevice(mosDevice: IMOSDevice): Promise<void> {
		let foundI = -1
		for (let i = 0; i < this._coreMosHandlers.length; i++) {
			const cmh = this._coreMosHandlers[i]
			if (cmh._mosDevice.idPrimary === mosDevice.idSecondary) {
				foundI = i
				break
			}
		}
		const coreMosHandler = this._coreMosHandlers[foundI]
		if (coreMosHandler) {
			return coreMosHandler.dispose().then(() => {
				this._coreMosHandlers.splice(foundI, 1)
				return
			})
		}
		return Promise.resolve()
	}
	onConnectionRestored(): void {
		this.setupSubscriptionsAndObservers().catch((e) => {
			this.logger.error(e)
		})
		if (this._onConnected) this._onConnected()
		this._coreMosHandlers.forEach((cmh: CoreMosDeviceHandler) => {
			cmh.setupSubscriptionsAndObservers()
		})
	}
	onConnected(fcn: () => any): void {
		this._onConnected = fcn
	}
	async setupSubscriptionsAndObservers(): Promise<void> {
		// console.log('setupObservers', this.core.deviceId)
		if (this._observers.length) {
			this.logger.info('Core: Clearing observers..')
			this._observers.forEach((obs) => {
				obs.stop()
			})
			this._observers = []
		}
		this._subscriptions = []

		if (!this.core) {
			throw Error('core is undefined!')
		}

		this.logger.info('Core: Setting up subscriptions for ' + this.core.deviceId + '..')
		return Promise.all([
			this.core.autoSubscribe('peripheralDevices', {
				_id: this.core.deviceId,
			}),
			this.core.autoSubscribe('peripheralDeviceCommands', this.core.deviceId),
		])
			.then((subs) => {
				this._subscriptions = this._subscriptions.concat(subs)
			})
			.then(() => {
				this.setupObserverForPeripheralDeviceCommands(this)

				return
			})
	}
	executeFunction(cmd: PeripheralDeviceCommand, fcnObject: CoreHandler | CoreMosDeviceHandler): void {
		if (cmd) {
			if (this._executedFunctions[unprotectString(cmd._id)]) return // prevent it from running multiple times
			this.logger.debug(cmd.functionName || cmd.actionId || '', cmd.args)
			this._executedFunctions[unprotectString(cmd._id)] = true
			// console.log('executeFunction', cmd)
			const cb = (err: any, res?: any) => {
				// console.log('cb', err, res)
				if (err) {
					this.logger.error('executeFunction error', err, err.stack)
				}

				if (!fcnObject.core) {
					throw Error('fcnObject.core is undefined!')
				}

				fcnObject.core.coreMethods
					.functionReply(cmd._id, err, res)
					.then(() => {
						// console.log('cb done')
					})
					.catch((e) => {
						this.logger.error(e)
					})
			}
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			const fcn = fcnObject[cmd.functionName]
			try {
				if (!fcn) throw Error('Function "' + cmd.functionName + '" not found!')

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
		}
	}
	retireExecuteFunction(cmdId: string): void {
		delete this._executedFunctions[cmdId]
	}
	setupObserverForPeripheralDeviceCommands(functionObject: CoreMosDeviceHandler | CoreHandler): void {
		if (!functionObject.core) {
			throw Error('functionObject.core is undefined!')
		}

		const observer = functionObject.core.observe('peripheralDeviceCommands')
		functionObject.killProcess(0) // just make sure it exists
		functionObject._observers.push(observer)
		const addedChangedCommand = (id: string) => {
			if (!functionObject.core) {
				throw Error('functionObject.core is undefined!')
			}

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
		// any should be PeripheralDeviceCommand
		cmds.find({}).forEach((cmd) => {
			if (!functionObject.core) {
				throw Error('functionObject.core is undefined!')
			}
			if (cmd.deviceId === functionObject.core.deviceId) {
				this.executeFunction(cmd, functionObject)
			}
		})
	}
	killProcess(actually: number): true | 0 {
		if (actually === 1) {
			this.logger.info('KillProcess command received, shutting down in 1000ms!')
			setTimeout(() => {
				// eslint-disable-next-line no-process-exit
				process.exit(0)
			}, 1000)
			return true
		}
		return 0
	}
	pingResponse(message: string): true {
		if (!this.core) {
			throw Error('core is undefined!')
		}
		this.core.setPingResponse(message)
		return true
	}
	getSnapshot(): any {
		this.logger.info('getSnapshot')
		return {} // TODO: send some snapshot data?
	}
	private _getVersions() {
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
