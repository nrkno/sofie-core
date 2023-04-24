import { EventEmitter } from 'eventemitter3'
import * as _ from 'underscore'
import {
	PeripheralDeviceStatusObject,
	PeripheralDeviceInitOptions,
	PeripheralDeviceSubType,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { PeripheralDeviceAPIMethods } from '@sofie-automation/shared-lib/dist/peripheralDevice/methodsAPI'
import { DDPConnector } from './ddpConnector'
import { Observer } from './ddpClient'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { ConnectionMethodsQueue, ExternalPeripheralDeviceAPI, makeMethods, makeMethodsLowPrio } from './methods'
import { PeripheralDeviceForDevice } from '@sofie-automation/shared-lib/dist/core/model/peripheralDevice'
import { ProtectedString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { CoreConnection, Collection, CoreOptions } from './coreConnection'
import { CorePinger } from './ping'

export interface ChildCoreOptions {
	deviceId: PeripheralDeviceId

	/**
	 * SubType of the connection
	 */
	deviceSubType: PeripheralDeviceSubType

	/**
	 * Name of the device
	 * eg 'MOS Gateway'
	 */
	deviceName: string
}

export type ChildCoreConnectionEvents = {
	error: [err: Error | string]
}

export class CoreConnectionChild extends EventEmitter<ChildCoreConnectionEvents> {
	private _parent: CoreConnection | undefined
	private _parentOptions!: CoreOptions
	private _coreOptions: ChildCoreOptions
	private _methodQueue!: ConnectionMethodsQueue

	private _autoSubscriptions: {
		[subscriptionId: string]: {
			publicationName: string
			params: Array<any>
		}
	} = {}
	private _pinger: CorePinger
	private _destroyed = false

	private _peripheralDeviceApi: ExternalPeripheralDeviceAPI
	private _peripheralDeviceApiLowPriority: ExternalPeripheralDeviceAPI

	constructor(coreOptions: ChildCoreOptions) {
		super()

		this._coreOptions = coreOptions

		this._peripheralDeviceApi = makeMethods(this, PeripheralDeviceAPIMethods)
		this._peripheralDeviceApiLowPriority = makeMethodsLowPrio(this, PeripheralDeviceAPIMethods)

		this._pinger = new CorePinger(
			(err) => this._emitError(err),
			async () => this.coreMethods.ping()
		)
	}

	private doTriggerPing = (connected: boolean) => {
		this._pinger.setConnected(connected)
		this._pinger.triggerPing()
	}

	async init(parent: CoreConnection, parentOptions: CoreOptions): Promise<PeripheralDeviceId> {
		this._destroyed = false

		parent.on('connected', this._renewAutoSubscriptions)
		parent.on('connectionChanged', this.doTriggerPing)

		this._parent = parent
		this._parentOptions = parentOptions

		this._methodQueue = new ConnectionMethodsQueue(this._parent.ddp, {
			deviceId: this._coreOptions.deviceId,
			deviceToken: parentOptions.deviceToken,
		})

		return this._sendInit()
	}
	async destroy(): Promise<void> {
		this._destroyed = true

		if (this._parent) {
			this._parent.off('connected', this._renewAutoSubscriptions)
			this._parent.off('connectionChanged', this.doTriggerPing)

			this._parent.removeChild(this)
			this._parent = undefined
		}

		this.removeAllListeners()

		this._pinger.destroy()
	}

	public get parent(): CoreConnection {
		if (!this._parent) throw new Error('Connection has been destroyed')
		return this._parent
	}
	get ddp(): DDPConnector {
		if (!this._parent) throw new Error('Connection has been destroyed')
		return this._parent.ddp
	}
	get connected(): boolean {
		return this._parent?.connected ?? false
	}
	get deviceId(): PeripheralDeviceId {
		return this._coreOptions.deviceId
	}
	get coreMethods(): ExternalPeripheralDeviceAPI {
		return this._peripheralDeviceApi
	}
	get coreMethodsLowPriority(): ExternalPeripheralDeviceAPI {
		return this._peripheralDeviceApiLowPriority
	}
	async setStatus(status: PeripheralDeviceStatusObject): Promise<PeripheralDeviceStatusObject> {
		return this.coreMethods.setStatus(status)
	}
	/**
	 * This should not be used directly, use the `coreMethods` wrapper instead.
	 * Call a meteor method
	 * @param methodName The name of the method to call
	 * @param attrs Parameters to the method
	 * @returns Resopnse, if any
	 */
	async callMethodRaw(methodName: string, attrs: Array<any>): Promise<any> {
		if (this._destroyed) {
			throw 'callMethod: CoreConnection has been destroyed'
		}

		return this._methodQueue.callMethodRaw(methodName, attrs)
	}
	async callMethodLowPrioRaw(methodName: PeripheralDeviceAPIMethods | string, attrs: Array<any>): Promise<any> {
		return this._methodQueue.callMethodLowPrioRaw(methodName, attrs)
	}
	async unInitialize(): Promise<PeripheralDeviceId> {
		return this.coreMethods.unInitialize()
	}
	async getPeripheralDevice(): Promise<PeripheralDeviceForDevice> {
		return this.coreMethods.getPeripheralDevice()
	}
	getCollection<DBObj extends { _id: ProtectedString<any> | string } = never>(
		collectionName: string
	): Collection<DBObj> {
		if (!this._parent) throw new Error('Connection has been destroyed')

		return this._parent.getCollection(collectionName)
	}
	async subscribe(publicationName: string, ...params: Array<any>): Promise<string> {
		return new Promise((resolve, reject) => {
			if (!this.ddp.ddpClient) {
				reject('subscribe: DDP client is not initialized')
				return
			}
			try {
				const subscriptionId = this.ddp.ddpClient.subscribe(
					publicationName,
					params.concat([this._parentOptions.deviceToken]),
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
		if (!this._parent) throw new Error('Connection has been destroyed')

		return this._parent.observe(collectionName)
	}
	// getCurrentTime(): number {
	// 	return this._timeSync?.currentTime() || 0
	// }
	// hasSyncedTime(): boolean {
	// 	return this._timeSync?.isGood() || false
	// }
	// syncTimeQuality(): number | null {
	// 	return this._timeSync?.quality || null
	// }

	private _emitError(e: Error | string) {
		if (!this._destroyed) {
			this.emit('error', e)
		} else {
			console.log('destroyed error', e)
		}
	}

	private async _sendInit(): Promise<PeripheralDeviceId> {
		if (!this.ddp || !this.ddp.connectionId || !this._parent) throw Error('Not connected to Core')

		const options: PeripheralDeviceInitOptions = {
			category: this._parentOptions.deviceCategory,
			type: this._parentOptions.deviceType,
			subType: this._coreOptions.deviceSubType,

			name: this._coreOptions.deviceName,
			connectionId: this.ddp.connectionId,
			parentDeviceId: this._parent.deviceId,

			documentationUrl: this._parentOptions.documentationUrl,
		}

		return this.coreMethods.initialize(options)
	}

	private _renewAutoSubscriptions = () => {
		_.each(this._autoSubscriptions, (sub) => {
			this.subscribe(sub.publicationName, ...sub.params).catch((e) =>
				this._emitError('renewSubscr ' + sub.publicationName + ': ' + e)
			)
		})
	}
}
