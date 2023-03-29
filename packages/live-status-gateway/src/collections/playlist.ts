import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection } from '../wsHandler'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

export class PlaylistsHandler extends CollectionBase<DBRundownPlaylist[]> implements Collection<DBRundownPlaylist[]> {
	public observerName: string

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super('PlaylistsHandler', undefined, undefined, logger, coreHandler)
		this.observerName = this._name
	}

	async setPlaylists(playlists: DBRundownPlaylist[]): Promise<void> {
		this._logger.info(`'${this._name}' handler received playlists update with ${playlists.length} playlists`)
		this._collectionData = playlists
		await this.notify(this._collectionData)
	}

	// override notify to implement empty array handling
	async notify(data: DBRundownPlaylist[] | undefined): Promise<void> {
		this._logger.info(
			`${this._name} notifying all observers of an update with ${this._collectionData?.length} playlists`
		)
		if (data !== undefined) {
			for (const observer of this._observers) {
				await observer.update(this._name, data)
			}
		}
	}
}

export class PlaylistHandler extends CollectionBase<DBRundownPlaylist> implements Collection<DBRundownPlaylist> {
	public observerName: string
	private _core: CoreConnection
	private _playlistsHandler: PlaylistsHandler

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super('PlaylistHandler', CollectionName.RundownPlaylists, 'rundownPlaylists', logger, coreHandler)
		this._core = coreHandler.coreConnection
		this.observerName = this._name
		this._playlistsHandler = new PlaylistsHandler(this._logger, this._coreHandler)
	}

	async init(): Promise<void> {
		await super.init()
		if (!this._studioId) return
		if (!this._collection) return
		if (!this._publication) return
		this._subscriptionId = await this._coreHandler.setupSubscription(this._publication, {
			studioId: this._studioId,
		})
		this._dbObserver = this._coreHandler.setupObserver(this._collection)
		if (this._collection) {
			const col = this._core.getCollection<DBRundownPlaylist>(this._collection)
			if (!col) throw new Error(`collection '${this._collection}' not found!`)
			const playlists = col.find(undefined)
			this._collectionData = playlists.find((p) => p.activationId)
			await this._playlistsHandler.setPlaylists(playlists)
			this._dbObserver.added = (id: string) => {
				void this.changed(id, 'added').catch(this._logger.error)
			}
			this._dbObserver.changed = (id: string) => {
				void this.changed(id, 'changed').catch(this._logger.error)
			}
		}
	}

	async changed(id: string, changeType: string): Promise<void> {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (!this._collection) return
		const col = this._core.getCollection<DBRundownPlaylist>(this._collection)
		if (!col) throw new Error(`collection '${this._collection}' not found!`)
		const playlists = col.find(undefined)
		await this._playlistsHandler.setPlaylists(playlists)
		this._collectionData = playlists.find((p) => p.activationId)
		await this.notify(this._collectionData)
	}

	get playlistsHandler(): PlaylistsHandler {
		return this._playlistsHandler
	}
}
