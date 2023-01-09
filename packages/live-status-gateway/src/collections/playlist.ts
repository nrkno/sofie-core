import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection } from '../wsHandler'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'

export class PlaylistsHandler extends CollectionBase<DBRundownPlaylist[]> implements Collection<DBRundownPlaylist[]> {
	_observerName: string

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super('PlaylistsHandler', undefined, logger, coreHandler)
		this._collection = this._name
		this._observerName = this._name
	}

	setPlaylists(playlists: DBRundownPlaylist[]): void {
		this._logger.info(`'${this._collection}' handler received playlists update with ${playlists.length} playlists`)
		this._collectionData = playlists
		this.notify(this._collectionData)
	}

	// override notify to implement empty array handling
	notify(data: DBRundownPlaylist[] | undefined): void {
		this._logger.info(
			`${this._collection} notifying all observers of an update with ${this._collectionData?.length} playlists`
		)
		this._observers.forEach((o) => (data ? o.update(this._name, data) : []))
	}
}

export class PlaylistHandler extends CollectionBase<DBRundownPlaylist> implements Collection<DBRundownPlaylist> {
	_observerName: string
	_core: CoreConnection
	_playlistsHandler: PlaylistsHandler

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super('PlaylistHandler', 'rundownPlaylists', logger, coreHandler)
		this._core = coreHandler.coreConnection
		this._observerName = this._name
		this._playlistsHandler = new PlaylistsHandler(this._logger, this._coreHandler)
	}

	async init(): Promise<void> {
		await super.init()
		if (!(this._studioId && this._collection)) return
		this._subscriptionId = await this._coreHandler.setupSubscription(this._collection, { studioId: this._studioId })
		this._dbObserver = this._coreHandler.setupObserver(this._collection)
		if (this._collection) {
			const col = this._core.getCollection<DBRundownPlaylist>(this._collection)
			if (!col) throw new Error(`collection '${this._collection}' not found!`)
			const playlists = col.find(undefined)
			this._collectionData = playlists.find((p) => p.activationId)
			this._playlistsHandler.setPlaylists(playlists)
			this._dbObserver.added = (id: string) => this.changed(id, 'added')
			this._dbObserver.changed = (id: string) => this.changed(id, 'changed')
		}
	}

	changed(id: string, changeType: string): void {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (!this._collection) return
		const col = this._core.getCollection<DBRundownPlaylist>(this._collection)
		if (!col) throw new Error(`collection '${this._collection}' not found!`)
		const playlists = col.find(undefined)
		this._playlistsHandler.setPlaylists(playlists)
		this._collectionData = playlists.find((p) => p.activationId)
		this.notify(this._collectionData)
	}

	get playlistsHandler(): PlaylistsHandler {
		return this._playlistsHandler
	}
}
