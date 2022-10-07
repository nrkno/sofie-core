import { EventEmitter } from 'eventemitter3'
import * as _ from 'underscore'
import {
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	PeripheralDeviceSubType,
	PERIPHERAL_SUBTYPE_PROCESS,
	StatusObject,
	InitOptions,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { PeripheralDeviceAPIMethods } from '@sofie-automation/shared-lib/dist/peripheralDevice/methodsAPI'

import { DDPConnector } from './ddpConnector'
import { DDPConnectorOptions, DDPError, Observer } from './ddpClient'

import { TimeSync } from './timeSync'
import { WatchDog } from './watchDog'
import { Queue } from './queue'
import { DeviceConfigManifest } from './configManifest'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PkgInfo = require('../../package.json')

// low-prio calls:
const TIMEOUTCALL = 200 // ms, time to wait after a call
const TIMEOUTREPLY = 50 // ms, time to wait after a reply

export interface CoreCredentials {
	deviceId: PeripheralDeviceId
	deviceToken: string
}

export interface CoreOptions extends CoreCredentials {
	deviceCategory: PeripheralDeviceCategory
	deviceType: PeripheralDeviceType //  deprecated
	deviceSubType?: PeripheralDeviceSubType // deprecated

	deviceName: string
	versions?: {
		[libraryName: string]: string
	}
	watchDog?: boolean

	configManifest?: DeviceConfigManifest
}
export interface CollectionObj {
	_id: string
	[key: string]: any
}
export interface Collection {
	find: (selector: any) => Array<CollectionObj>
	findOne: (selector: any) => CollectionObj
}
interface QueuedMethodCall {
	f: () => Promise<any>
	resolve: (r: any) => void
	reject: (e: Error) => void
}

export type CoreConnectionEvents = {
	connected: []
	connectionChanged: [connected: boolean]
	disconnected: []
	failed: [err: Error]
	error: [err: Error | string]
}
export class CoreConnection extends EventEmitter<CoreConnectionEvents> {
	private _ddp: DDPConnector | undefined
	private _parent: CoreConnection | null = null
	private _children: Array<CoreConnection> = []
	private _coreOptions: CoreOptions
	private _timeSync: TimeSync | null = null
	private _watchDog?: WatchDog
	private _watchDogPingResponse = ''
	private _connected = false
	private _autoSubscriptions: {
		[subscriptionId: string]: {
			publicationName: string
			params: Array<any>
		}
	} = {}
	private _sentConnectionId = ''
	private _pingTimeout: NodeJS.Timer | null = null
	private queuedMethodCalls: Array<QueuedMethodCall> = []
	private _triggerDoQueueTimer: NodeJS.Timer | null = null
	private _timeLastMethodCall = 0
	private _timeLastMethodReply = 0
	private _destroyed = false
	private _queues: { [queueName: string]: Queue } = {}

	constructor(coreOptions: CoreOptions) {
		super()

		this._coreOptions = coreOptions

		if (this._coreOptions.watchDog) {
			this._watchDog = new WatchDog()
			this._watchDog.on('message', (msg) => this._emitError('msg ' + msg))
			this._watchDog.startWatching()
		}
	}
	async init(ddpOptionsORParent?: DDPConnectorOptions | CoreConnection): Promise<string> {
		this._destroyed = false
		this.on('connected', () => this._renewAutoSubscriptions())

		if (ddpOptionsORParent instanceof CoreConnection) {
			this._setParent(ddpOptionsORParent)
			return this._sendInit()
		} else {
			const ddpOptions = ddpOptionsORParent || {
				host: '127.0.0.1',
				port: 3000,
			}
			// TODO: The following line is ignored - autoReconnect ends up as false - which is what the tests want. Why?
			if (!_.has(ddpOptions, 'autoReconnect')) ddpOptions.autoReconnect = true
			if (!_.has(ddpOptions, 'autoReconnectTimer')) ddpOptions.autoReconnectTimer = 1000
			this._ddp = new DDPConnector(ddpOptions)

			this._ddp.on('error', (err) => {
				this._emitError('ddpError: ' + (_.isObject(err) && err.message) || err.toString())
			})
			this._ddp.on('failed', (err) => {
				this.emit('failed', err)
			})
			this._ddp.on('connected', () => {
				// this.emit('connected')
				if (this._watchDog) this._watchDog.addCheck(async () => this._watchDogCheck())
			})
			this._ddp.on('disconnected', () => {
				// this.emit('disconnected')
				if (this._watchDog) this._watchDog.removeCheck(async () => this._watchDogCheck())
			})
			this._ddp.on('message', () => {
				if (this._watchDog) this._watchDog.receivedData()
			})
			await this._ddp.createClient()
			await this._ddp.connect()
			this._setConnected(this._ddp.connected) // ensure that connection status is synced

			// set up the connectionChanged event handler after we've connected, so that it doesn't trigger on the await this._ddp.connect()
			this._ddp.on('connectionChanged', (connected: boolean) => {
				this._setConnected(connected)

				this._maybeSendInit().catch((err) => {
					this._emitError('_maybesendInit ' + JSON.stringify(err))
				})
			})

			const deviceId = await this._sendInit()
			this._timeSync = new TimeSync(
				{
					serverDelayTime: 0,
				},
				async () => {
					const stat = await this.callMethod(PeripheralDeviceAPIMethods.getTimeDiff)
					return stat.currentTime
				}
			)

			await this._timeSync.init()
			this._triggerPing()
			return deviceId
		}
	}
	async destroy(): Promise<void> {
		this._destroyed = true
		if (this._parent) {
			this._removeParent()
		} else {
			this._removeParent()
			if (this._ddp) {
				this._ddp.close()
			}
		}
		this.removeAllListeners()

		if (this._watchDog) this._watchDog.stopWatching()

		if (this._pingTimeout) {
			clearTimeout(this._pingTimeout)
			this._pingTimeout = null
		}

		if (this._timeSync) {
			this._timeSync.stop()
			this._timeSync = null
		}

		await Promise.all(
			_.map(this._children, async (child: CoreConnection) => {
				return child.destroy()
			})
		)
		this._children = []
	}
	addChild(child: CoreConnection): void {
		this._children.push(child)
	}
	removeChild(childToRemove: CoreConnection): void {
		let removeIndex = -1
		this._children.forEach((c, i) => {
			if (c === childToRemove) removeIndex = i
		})
		if (removeIndex !== -1) {
			this._children.splice(removeIndex, 1)
		}
	}
	onConnectionChanged(cb: (connected: boolean) => void): void {
		this.on('connectionChanged', cb)
	}
	onConnected(cb: () => void): void {
		this.on('connected', cb)
	}
	onDisconnected(cb: () => void): void {
		this.on('disconnected', cb)
	}
	onError(cb: (err: Error | string) => void): void {
		this.on('error', cb)
	}
	onFailed(cb: (err: Error) => void): void {
		this.on('failed', cb)
	}
	get ddp(): DDPConnector {
		if (this._parent) {
			return this._parent.ddp
		} else if (!this._ddp) {
			throw new Error('Not connected to Core')
		} else {
			return this._ddp
		}
	}
	get connected(): boolean {
		return this._connected
		// return (this.ddp ? this.ddp.connected : false)
	}
	get deviceId(): PeripheralDeviceId {
		return this._coreOptions.deviceId
	}
	async setStatus(status: StatusObject): Promise<StatusObject> {
		return this.callMethod(PeripheralDeviceAPIMethods.setStatus, [status])
	}
	async callMethod(methodName: PeripheralDeviceAPIMethods | string, attrs?: Array<any>): Promise<any> {
		return new Promise((resolve, reject) => {
			if (this._destroyed) {
				reject('callMethod: CoreConnection has been destroyed')
				return
			}
			if (!methodName) {
				reject('callMethod: argument missing: methodName')
				return
			}

			const fullAttrs = [this._coreOptions.deviceId, this._coreOptions.deviceToken].concat(attrs || [])

			this._timeLastMethodCall = Date.now()
			if (!this.ddp.ddpClient) {
				reject('callMehod: DDP client has not been initialized')
				return
			}
			const timeout = setTimeout(() => {
				// Timeout
				console.error(`Timeout "${methodName}"`)
				console.error(JSON.stringify(fullAttrs))
				reject(
					`Timeout when calling method "${methodName}", arguments: ${JSON.stringify(fullAttrs).slice(0, 200)}`
				)
			}, 10 * 1000) // 10 seconds
			this.ddp.ddpClient.call(methodName, fullAttrs, (err: DDPError | undefined, result: any) => {
				clearTimeout(timeout)
				this._timeLastMethodReply = Date.now()
				if (err) {
					if (typeof err === 'object') {
						// Add a custom toString() method, because the default object will just print "[object Object]"
						err.toString = () => {
							if (err.message) {
								return err.message // + (err.stack ? '\n' + err.stack : '')
							} else {
								return JSON.stringify(err)
							}
						}
					}
					reject(err)
				} else {
					resolve(result)
				}
			})
		})
	}
	async callMethodLowPrio(methodName: PeripheralDeviceAPIMethods | string, attrs?: Array<any>): Promise<any> {
		return new Promise((resolve, reject) => {
			this.queuedMethodCalls.push({
				f: async () => {
					return this.callMethod(methodName, attrs)
				},
				resolve: resolve,
				reject: reject,
			})
			this._triggerDoQueue()
		})
	}
	async unInitialize(): Promise<string> {
		return this.callMethod(PeripheralDeviceAPIMethods.unInitialize)
	}
	async mosManipulate(method: string, ...attrs: Array<any>): Promise<any> {
		return this.callMethod(method, attrs)
	}
	async getPeripheralDevice(): Promise<any> {
		return this.callMethod(PeripheralDeviceAPIMethods.getPeripheralDevice)
	}
	getCollection(collectionName: string): Collection {
		if (!this.ddp.ddpClient) {
			throw new Error('getCollection: DDP client not initialized')
		}
		const collections = this.ddp.ddpClient.collections

		const c: Collection = {
			find(selector?: any): Array<CollectionObj> {
				const collection = collections[collectionName] || {}
				if (_.isUndefined(selector)) {
					return _.values(collection)
				} else if (_.isFunction(selector)) {
					return _.filter(_.values(collection), selector)
				} else if (_.isObject(selector)) {
					return _.where(_.values(collection), selector)
				} else {
					return [collection[selector]]
				}
			},
			findOne(selector: any): CollectionObj {
				return c.find(selector)[0]
			},
		}
		return c
	}
	async subscribe(publicationName: string, ...params: Array<any>): Promise<string> {
		return new Promise((resolve, reject) => {
			if (!this.ddp.ddpClient) {
				reject('subscribe: DDP client is not initialized')
				return
			}
			try {
				const subscriptionId = this.ddp.ddpClient.subscribe(
					publicationName, // name of Meteor Publish function to subscribe to
					params.concat([this._coreOptions.deviceToken]), // parameters used by the Publish function
					() => {
						// callback when the subscription is complete
						resolve(subscriptionId)
					}
				)
			} catch (e) {
				reject(e)
			}
		})
	}
	/**
	 * Like a subscribe, but automatically renews it upon reconnection
	 */
	async autoSubscribe(publicationName: string, ...params: Array<any>): Promise<string> {
		const subscriptionId = await this.subscribe(publicationName, ...params)
		this._autoSubscriptions[subscriptionId] = {
			publicationName: publicationName,
			params: params,
		}
		return subscriptionId
	}
	unsubscribe(subscriptionId: string): void {
		this.ddp.ddpClient?.unsubscribe(subscriptionId)
		delete this._autoSubscriptions[subscriptionId]
	}
	observe(collectionName: string): Observer {
		if (!this.ddp.ddpClient) {
			throw new Error('observe: DDP client not initialised')
		}
		return this.ddp.ddpClient.observe(collectionName)
	}
	getCurrentTime(): number {
		return this._timeSync?.currentTime() || 0
	}
	hasSyncedTime(): boolean {
		return this._timeSync?.isGood() || false
	}
	syncTimeQuality(): number | null {
		return this._timeSync?.quality || null
	}
	setPingResponse(message: string): void {
		this._watchDogPingResponse = message
	}
	async putOnQueue<T>(queueName: string, fcn: () => Promise<T>): Promise<T> {
		if (!this._queues[queueName]) {
			this._queues[queueName] = new Queue()
		}
		return this._queues[queueName].putOnQueue(fcn)
	}
	private _emitError(e: Error | string) {
		if (!this._destroyed) {
			this.emit('error', e)
		} else {
			console.log('destroyed error', e)
		}
	}
	private _setConnected(connected: boolean) {
		const prevConnected = this._connected
		this._connected = connected
		if (prevConnected !== connected) {
			if (connected) this.emit('connected')
			else this.emit('disconnected')
			this.emit('connectionChanged', connected)
			this._triggerPing()
		}
	}
	private async _maybeSendInit(): Promise<any> {
		// If the connectionId has changed, we should report that to Core:
		if (this.ddp && this.ddp.connectionId !== this._sentConnectionId) {
			return this._sendInit()
		} else {
			return Promise.resolve()
		}
	}
	private async _sendInit(): Promise<string> {
		if (!this.ddp || !this.ddp.connectionId) throw Error('Not connected to Core')

		const options: InitOptions = {
			category: this._coreOptions.deviceCategory,
			type: this._coreOptions.deviceType,
			subType: this._coreOptions.deviceSubType,

			name: this._coreOptions.deviceName,
			connectionId: this.ddp.connectionId,
			parentDeviceId: this._parent?.deviceId || undefined,
			versions: this._coreOptions.versions,

			configManifest: this._coreOptions.configManifest,
		}

		if (options.subType === PERIPHERAL_SUBTYPE_PROCESS) {
			if (!options.versions) options.versions = {}
			options.versions['@sofie-automation/server-core-integration'] = PkgInfo.version
		}

		this._sentConnectionId = options.connectionId
		return this.callMethod(PeripheralDeviceAPIMethods.initialize, [options])
	}
	private _removeParent() {
		if (this._parent) this._parent.removeChild(this)
		this._parent = null
		this._setConnected(false)
	}
	private _setParent(parent: CoreConnection) {
		this._parent = parent
		parent.addChild(this)

		parent.on('connectionChanged', (connected) => {
			this._setConnected(connected)
		})
		this._setConnected(parent.connected)
	}
	private async _watchDogCheck() {
		/*
			Randomize a message and send it to Core.
			Core should then reply with triggering executeFunction with the "pingResponse" method.
		*/
		const message = 'watchdogPing_' + Math.round(Math.random() * 100000)
		this.callMethod(PeripheralDeviceAPIMethods.pingWithCommand, [message]).catch((e) =>
			this._emitError('watchdogPing' + e)
		)

		return new Promise<void>((resolve, reject) => {
			let i = 0
			const checkPingReply = () => {
				if (this._watchDogPingResponse === message) {
					// if we've got a good watchdog response, we can delay the pinging:
					this._triggerDelayPing()

					resolve()
				} else {
					i++
					if (i > 50) {
						reject()
					} else {
						setTimeout(checkPingReply, 300)
					}
				}
			}
			checkPingReply()
		}).then(() => {
			return
		})
	}
	private _renewAutoSubscriptions() {
		_.each(this._autoSubscriptions, (sub) => {
			this.subscribe(sub.publicationName, ...sub.params).catch((e) =>
				this._emitError('renewSubscr ' + sub.publicationName + ': ' + e)
			)
		})
	}
	private _triggerPing() {
		if (!this._pingTimeout) {
			this._pingTimeout = setTimeout(() => {
				this._pingTimeout = null
				this._ping()
			}, 90 * 1000)
		}
	}
	private _triggerDelayPing() {
		// delay the ping:
		if (this._pingTimeout) {
			clearTimeout(this._pingTimeout)
			this._pingTimeout = null
		}
		this._triggerPing()
	}
	private _ping() {
		try {
			if (this.connected) {
				this.callMethod(PeripheralDeviceAPIMethods.ping).catch((e) => this._emitError('_ping' + e))
			}
		} catch (e) {
			this._emitError('_ping2 ' + e)
		}
		if (this.connected) {
			this._triggerPing()
		}
	}
	private _triggerDoQueue(time = 2) {
		if (!this._triggerDoQueueTimer) {
			this._triggerDoQueueTimer = setTimeout(() => {
				this._triggerDoQueueTimer = null

				this._doQueue()
			}, time)
		}
	}
	private _doQueue() {
		// check if we can send a call?
		const timeSinceLastMethodCall = Date.now() - this._timeLastMethodCall
		const timeSinceLastMethodReply = Date.now() - this._timeLastMethodReply

		if (timeSinceLastMethodCall < TIMEOUTCALL) {
			// Not enough time has passed since last method call
			this._triggerDoQueue(TIMEOUTCALL - timeSinceLastMethodCall + 1)
		} else if (timeSinceLastMethodReply < TIMEOUTREPLY) {
			// Not enough time has passed since last method reply
			this._triggerDoQueue(TIMEOUTREPLY - timeSinceLastMethodReply + 1)
		} else {
			// yep, it's time to send a command!

			const c = this.queuedMethodCalls.shift()
			if (c) {
				c.f()
					.then((result) => {
						this._triggerDoQueue()
						c.resolve(result)
					})
					.catch((err) => {
						this._triggerDoQueue()
						c.reject(err)
					})
			}
		}
	}
}
