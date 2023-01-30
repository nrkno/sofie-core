import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Observer } from '@sofie-automation/server-core-integration'
import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { CoreHandler } from './coreHandler'

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
		this._logger.info(`Send ${this._name} message '${msgStr}'`)
		ws.send(msgStr)
	}
}

export interface WebSocketTopic {
	addSubscriber(ws: WebSocket): void
	hasSubscriber(ws: WebSocket): boolean
	removeSubscriber(ws: WebSocket): void
	processMessage(ws: WebSocket, msg: object): void
	sendMessage(ws: WebSocket, msg: object): void
}

export abstract class CollectionBase<T> {
	protected _name: string
	protected _collection: string | undefined
	protected _logger: Logger
	protected _coreHandler: CoreHandler
	protected _studioId: StudioId | undefined
	protected _subscribers: Set<WebSocket> = new Set()
	protected _observers: Set<CollectionObserver<T>> = new Set()
	protected _collectionData: T | undefined
	protected _subscriptionId: string | undefined
	protected _dbObserver: Observer | undefined

	constructor(name: string, collection: string | undefined, logger: Logger, coreHandler: CoreHandler) {
		this._name = name
		this._collection = collection
		this._logger = logger
		this._coreHandler = coreHandler

		this._logger.info(`Starting ${this._name} handler`)
	}

	async init(): Promise<void> {
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
