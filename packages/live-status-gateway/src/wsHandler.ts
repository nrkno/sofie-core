import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CoreConnection, Observer, ProtectedString, SubscriptionId } from '@sofie-automation/server-core-integration'
import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { CoreHandler } from './coreHandler'
import { CorelibPubSub, CorelibPubSubCollections, CorelibPubSubTypes } from '@sofie-automation/corelib/dist/pubsub'

export abstract class WebSocketTopicBase {
	protected _name: string
	protected _logger: Logger
	protected _subscribers: Set<WebSocket> = new Set()

	constructor(name: string, logger: Logger) {
		this._name = name
		this._logger = logger

		this._logger.info(`Starting ${this._name} topic`)
	}

	addSubscriber(ws: WebSocket): void {
		this._logger.info(`${this._name} adding a websocket subscriber`)
		this._subscribers.add(ws)
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

	sendMessage(ws: WebSocket, msg: object): void {
		const msgStr = JSON.stringify(msg)
		this._logger.debug(`Send ${this._name} message '${msgStr}'`)
		ws.send(msgStr)
	}

	sendHeartbeat(ws: WebSocket): void {
		const msgStr = JSON.stringify({ event: 'heartbeat' })
		this._logger.silly(`Send ${this._name} message '${msgStr}'`)
		ws.send(msgStr)
	}

	protected logUpdateReceived(collectionName: string, source: string, extraInfo?: string): void {
		let message = `${this._name} received ${collectionName} update from ${source}`
		if (extraInfo) {
			message += `, ${extraInfo}`
		}
		this._logger.debug(message)
	}
}

export interface WebSocketTopic {
	addSubscriber(ws: WebSocket): void
	hasSubscriber(ws: WebSocket): boolean
	removeSubscriber(ws: WebSocket): void
	processMessage(ws: WebSocket, msg: object): void
	sendMessage(ws: WebSocket, msg: object): void
}

export type ObserverForCollection<T> = T extends keyof CorelibPubSubCollections
	? Observer<CorelibPubSubCollections[T]>
	: undefined

export abstract class CollectionBase<
	T,
	TPubSub extends CorelibPubSub | undefined,
	TCollection extends keyof CorelibPubSubCollections
> {
	protected _name: string
	protected _collectionName: TCollection
	protected _publicationName: TPubSub
	protected _logger: Logger
	protected _coreHandler: CoreHandler
	protected _studioId!: StudioId
	protected _subscribers: Set<WebSocket> = new Set()
	protected _observers: Set<CollectionObserver<T>> = new Set()
	protected _collectionData: T | undefined
	protected _subscriptionId: SubscriptionId | undefined
	protected _dbObserver: ObserverForCollection<TCollection> | undefined

	protected get _core(): CoreConnection<CorelibPubSubTypes, CorelibPubSubCollections> {
		return this._coreHandler.core
	}

	constructor(name: string, collection: TCollection, publication: TPubSub, logger: Logger, coreHandler: CoreHandler) {
		this._name = name
		this._collectionName = collection
		this._publicationName = publication
		this._logger = logger
		this._coreHandler = coreHandler

		this._logger.info(`Starting ${this._name} handler`)
	}

	async init(): Promise<void> {
		if (!this._coreHandler.studioId) throw new Error('StudioId is not defined')
		this._studioId = this._coreHandler.studioId
	}

	close(): void {
		this._logger.info(`Closing ${this._name} handler`)
		if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
		if (this._dbObserver) this._dbObserver.stop()
	}

	async subscribe(observer: CollectionObserver<T>): Promise<void> {
		this._logger.info(`${observer.observerName}' added observer for '${this._name}'`)
		if (this._collectionData) await observer.update(this._name, this._collectionData)
		this._observers.add(observer)
	}

	async unsubscribe(observer: CollectionObserver<T>): Promise<void> {
		this._logger.info(`${observer.observerName}' removed observer for '${this._name}'`)
		this._observers.delete(observer)
	}

	async notify(data: T | undefined): Promise<void> {
		for (const observer of this._observers) {
			await observer.update(this._name, data)
		}
	}

	protected logDocumentChange(documentId: string | ProtectedString<any>, changeType: string): void {
		this._logger.silly(`${this._name} ${changeType} ${documentId}`)
	}

	protected logUpdateReceived(collectionName: string, updateCount: number | undefined): void
	protected logUpdateReceived(collectionName: string, source: string, extraInfo?: string): void
	protected logUpdateReceived(
		collectionName: string,
		sourceOrUpdateCount: string | number | undefined,
		extraInfo?: string
	): void {
		if (typeof sourceOrUpdateCount === 'string') {
			let message = `${this._name} received ${collectionName} update from ${sourceOrUpdateCount}`
			if (extraInfo) {
				message += `, ${extraInfo}`
			}
			this._logger.debug(message)
		} else {
			this._logger.debug(`'${this._name}' handler received ${sourceOrUpdateCount} ${collectionName}`)
		}
	}

	protected logNotifyingUpdate(updateCount: number | undefined): void {
		this._logger.debug(`${this._name} notifying update with ${updateCount} ${this._collectionName}`)
	}
}

export interface Collection<T> {
	init(): Promise<void>
	close(): void
	subscribe(observer: CollectionObserver<T>): Promise<void>
	unsubscribe(observer: CollectionObserver<T>): Promise<void>
	notify(data: T | undefined): Promise<void>
}

export interface CollectionObserver<T> {
	observerName: string
	update(source: string, data: T | undefined): Promise<void>
}
