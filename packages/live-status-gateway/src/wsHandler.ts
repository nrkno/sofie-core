import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	CollectionDocCheck,
	CoreConnection,
	Observer,
	PeripheralDevicePubSubCollections,
	ProtectedString,
	SubscriptionId,
} from '@sofie-automation/server-core-integration'
import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { CoreHandler } from './coreHandler'
import { CorelibPubSubCollections, CorelibPubSubTypes } from '@sofie-automation/corelib/dist/pubsub'
import throttleToNextTick from '@sofie-automation/shared-lib/dist/lib/throttleToNextTick'
import _ = require('underscore')
import { Collection as CoreCollection } from '@sofie-automation/server-core-integration'
import { CollectionHandlers } from './liveStatusServer'
import { arePropertiesShallowEqual } from './helpers/equality'
import { ParametersOfFunctionOrNever } from '@sofie-automation/server-core-integration/dist/lib/subscriptions'

export abstract class WebSocketTopicBase {
	protected _name: string
	protected _logger: Logger
	protected _subscribers: Set<WebSocket> = new Set()
	protected throttledSendStatusToAll: () => void

	constructor(name: string, logger: Logger, throttlePeriodMs = 0) {
		this._name = name
		this._logger = logger

		this._logger.info(`Starting ${this._name} topic`)
		this.throttledSendStatusToAll =
			throttlePeriodMs > 0
				? _.throttle(this.sendStatusToAll, throttlePeriodMs, {
						leading: false,
						trailing: true,
				  })
				: this.sendStatusToAll
	}

	addSubscriber(ws: WebSocket): void {
		this._logger.info(`${this._name} adding a websocket subscriber`)
		this._subscribers.add(ws)
		this.sendStatus([ws])
	}

	hasSubscriber(ws: WebSocket): boolean {
		return this._subscribers.has(ws)
	}

	removeSubscriber(ws: WebSocket): void {
		if (this._subscribers.delete(ws)) this._logger.info(`${this._name} removing a websocket subscriber`)
	}

	processMessage(_ws: WebSocket, msg: object): void {
		this._logger.error(`Process ${this._name} message not expected '${JSON.stringify(msg)}'`)
	}

	sendMessage(recipients: WebSocket | Iterable<WebSocket>, msg: object): void {
		recipients = isIterable(recipients) ? recipients : [recipients]

		let count = 0
		let msgStr = ''
		for (const ws of recipients) {
			if (!msgStr) msgStr = JSON.stringify(msg) // Optimization: only stringify if there are any recipients
			count++
			ws.send(msgStr)
		}
		this._logger.silly(`Send ${this._name} message '${msgStr}' to ${count} recipients`)
	}

	sendHeartbeat(recipients: Set<WebSocket>): void {
		const msgStr = JSON.stringify({ event: 'heartbeat' })
		for (const ws of recipients.values()) {
			ws.send(msgStr)
		}
	}

	protected logUpdateReceived(collectionName: string, extraInfo?: string): void {
		let message = `${this._name} received ${collectionName} update`
		if (extraInfo) {
			message += `, ${extraInfo}`
		}
		this._logger.debug(message)
	}

	abstract sendStatus(_subscribers: Iterable<WebSocket>): void

	protected sendStatusToAll = (): void => {
		this.sendStatus(this._subscribers)
	}
}

export interface WebSocketTopic {
	addSubscriber(ws: WebSocket): void
	hasSubscriber(ws: WebSocket): boolean
	removeSubscriber(ws: WebSocket): void
	processMessage(ws: WebSocket, msg: object): void
	sendMessage(ws: WebSocket, msg: object): void
}

const DEFAULT_THROTTLE_PERIOD_MS = 20

export abstract class CollectionBase<T, TCollection extends keyof CorelibPubSubCollections> {
	protected _name: string
	protected _collectionName: TCollection
	protected _logger: Logger
	protected _coreHandler: CoreHandler
	protected _studioId!: StudioId
	protected _observers: Map<
		ObserverCallback<T, keyof T>,
		{ keysToPick: readonly (keyof T)[] | undefined; lastData: T | undefined }
	> = new Map()
	protected _collectionData: T | undefined

	protected get _core(): CoreConnection<CorelibPubSubTypes, CorelibPubSubCollections> {
		return this._coreHandler.core
	}
	protected throttledChanged: () => void

	constructor(
		collection: TCollection,
		logger: Logger,
		coreHandler: CoreHandler,
		throttlePeriodMs = DEFAULT_THROTTLE_PERIOD_MS
	) {
		this._name = this.constructor.name
		this._collectionName = collection
		this._logger = logger
		this._coreHandler = coreHandler

		this.throttledChanged = throttleToNextTick(
			throttlePeriodMs > 0
				? _.throttle(() => this.changed(), throttlePeriodMs, { leading: true, trailing: true })
				: () => this.changed()
		)

		this._logger.info(`Starting ${this._name} handler`)
	}

	init(_handlers: CollectionHandlers): void {
		if (!this._coreHandler.studioId) throw new Error('StudioId is not defined')
		this._studioId = this._coreHandler.studioId
	}

	close(): void {
		this._logger.info(`Closing ${this._name} handler`)
	}

	subscribe<K extends keyof T>(callback: ObserverCallback<T, K>, keysToPick?: readonly K[]): void {
		//this._logger.info(`${name}' added observer for '${this._name}'`)
		if (this._collectionData) callback(this._collectionData)
		this._observers.set(callback, { keysToPick, lastData: this.shallowClone(this._collectionData) })
	}

	/**
	 * Called after a batch of updates to documents in the collection
	 */
	protected changed(): void {
		// override me
	}

	notify(data: T | undefined): void {
		for (const [observer, o] of this._observers) {
			if (
				!o.lastData ||
				!o.keysToPick ||
				!data ||
				!arePropertiesShallowEqual(o.lastData, data, undefined, o.keysToPick)
			) {
				observer(data)
				o.lastData = this.shallowClone(data)
			}
		}
	}

	protected shallowClone(data: T | undefined): T | undefined {
		if (data === undefined) return undefined
		if (Array.isArray(data)) return [...data] as T
		if (typeof data === 'object') return { ...data }
		return data
	}

	protected logDocumentChange(documentId: string | ProtectedString<any>, changeType: string): void {
		this._logger.silly(`${this._name} ${changeType} ${documentId}`)
	}

	protected logUpdateReceived(collectionName: string, updateCount: number | undefined): void
	protected logUpdateReceived(collectionName: string, extraInfo?: string): void
	protected logUpdateReceived(
		collectionName: string,
		extraInfoOrUpdateCount: string | number | undefined | null = null
	): void {
		let message = `${this._name} received ${collectionName} update`
		if (typeof extraInfoOrUpdateCount === 'string') {
			message += `, ${extraInfoOrUpdateCount}`
		} else if (extraInfoOrUpdateCount !== null) {
			message += `(${extraInfoOrUpdateCount})`
		}
		this._logger.debug(message)
	}

	protected logNotifyingUpdate(updateCount: number | undefined): void {
		this._logger.debug(`${this._name} notifying update with ${updateCount} ${this._collectionName}`)
	}

	protected getCollectionOrFail(): CoreCollection<CollectionDocCheck<CorelibPubSubCollections[TCollection]>> {
		const collection = this._core.getCollection<TCollection>(this._collectionName)
		if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
		return collection
	}
}

export abstract class PublicationCollection<
	T,
	TPubSub extends keyof CorelibPubSubTypes,
	TCollection extends keyof CorelibPubSubCollections
> extends CollectionBase<T, TCollection> {
	protected _publicationName: TPubSub
	protected _subscriptionId: SubscriptionId | undefined
	protected _subscriptionPending = false
	protected _dbObserver:
		| Observer<CollectionDocCheck<(CorelibPubSubCollections & PeripheralDevicePubSubCollections)[TCollection]>>
		| undefined

	constructor(
		collection: TCollection,
		publication: TPubSub,
		logger: Logger,
		coreHandler: CoreHandler,
		throttlePeriodMs = DEFAULT_THROTTLE_PERIOD_MS
	) {
		super(collection, logger, coreHandler, throttlePeriodMs)
		this._publicationName = publication
	}

	close(): void {
		super.close()
		if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
		this._dbObserver?.stop()
	}

	subscribe<K extends keyof T>(callback: ObserverCallback<T, K>, keysToPick?: readonly K[]): void {
		//this._logger.info(`${name}' added observer for '${this._name}'`)
		if (this._collectionData) callback(this._collectionData)
		this._observers.set(callback, { keysToPick, lastData: this.shallowClone(this._collectionData) })
	}

	/**
	 * Called after a batch of updates to documents in the collection
	 */
	protected changed(): void {
		// override me
	}

	private onDocumentEvent(id: ProtectedString<any> | string, changeType: string): void {
		this.logDocumentChange(id, changeType)
		if (!this._subscriptionId) {
			this._logger.silly(`${this._name} ${changeType} ${id} skipping (lack of subscription)`)
			return
		}
		if (this._subscriptionPending) {
			this._logger.silly(`${this._name} ${changeType} ${id} skipping (subscription pending)`)
			return
		}
		this.throttledChanged()
	}

	private setupObserver(): void {
		this._dbObserver = this._coreHandler.setupObserver(this._collectionName)
		this._dbObserver.added = (id) => {
			this.onDocumentEvent(id, 'added')
		}
		this._dbObserver.changed = (id) => {
			this.onDocumentEvent(id, 'changed')
		}
		this._dbObserver.removed = (id) => {
			this.onDocumentEvent(id, 'removed')
		}
	}

	protected stopSubscription(): void {
		if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
		this._subscriptionId = undefined
		this._dbObserver?.stop()
		this._dbObserver = undefined
	}

	protected setupSubscription(...args: ParametersOfFunctionOrNever<CorelibPubSubTypes[TPubSub]>): void {
		if (!this._publicationName) throw new Error(`Publication name not set for '${this._name}'`)
		this.stopSubscription()
		this._subscriptionPending = true
		this._coreHandler
			.setupSubscription(this._publicationName, ...args)
			.then((subscriptionId) => {
				this._subscriptionId = subscriptionId
				this.setupObserver()
			})
			.catch((e) => this._logger.error(e))
			.finally(() => {
				this._subscriptionPending = false
				this.changed()
			})
	}
}

export interface Collection<T> {
	init(handlers: CollectionHandlers): void
	close(): void
	subscribe<K extends keyof T>(callback: ObserverCallback<T, K>, keys?: K[]): void
	notify(data: T | undefined): void
}

export type ObserverCallback<T, K extends keyof T> = (data: Pick<T, K> | undefined) => void

export type PickArr<T, K extends readonly (keyof T)[]> = Pick<T, K[number]>

// export interface CollectionObserver<T, K extends keyof T> {
// 	observerName: string
// 	update(source: string, data: Pick<T, K> | undefined): void
// }
function isIterable<T>(obj: T | Iterable<T>): obj is Iterable<T> {
	// checks for null and undefined
	if (obj == null) {
		return false
	}
	return typeof (obj as any)[Symbol.iterator] === 'function'
}
