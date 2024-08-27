import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection } from '../wsHandler'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export class PlaylistsHandler
	extends CollectionBase<DBRundownPlaylist[], undefined, CollectionName.RundownPlaylists>
	implements Collection<DBRundownPlaylist[]>
{
	public observerName: string

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(PlaylistsHandler.name, CollectionName.RundownPlaylists, undefined, logger, coreHandler)
		this.observerName = this._name
	}

	async setPlaylists(playlists: DBRundownPlaylist[]): Promise<void> {
		this.logUpdateReceived('playlists', playlists.length)
		this._collectionData = playlists
		await this.notify(this._collectionData)
	}

	// override notify to implement empty array handling
	async notify(data: DBRundownPlaylist[] | undefined): Promise<void> {
		this.logNotifyingUpdate(this._collectionData?.length)
		if (data !== undefined) {
			for (const observer of this._observers) {
				await observer.update(this._name, data)
			}
		}
	}
}

export class PlaylistHandler
	extends CollectionBase<DBRundownPlaylist, CorelibPubSub.rundownPlaylists, CollectionName.RundownPlaylists>
	implements Collection<DBRundownPlaylist>
{
	public observerName: string
	private _playlistsHandler: PlaylistsHandler

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(
			PlaylistHandler.name,
			CollectionName.RundownPlaylists,
			CorelibPubSub.rundownPlaylists,
			logger,
			coreHandler
		)
		this.observerName = this._name
		this._playlistsHandler = new PlaylistsHandler(this._logger, this._coreHandler)
	}

	async init(): Promise<void> {
		await super.init()
		if (!this._studioId) return
		if (!this._collectionName) return
		if (!this._publicationName) return
		this._subscriptionId = await this._coreHandler.setupSubscription(this._publicationName, null, [this._studioId])
		this._dbObserver = this._coreHandler.setupObserver(this._collectionName)
		if (this._collectionName) {
			const col = this._core.getCollection(this._collectionName)
			if (!col) throw new Error(`collection '${this._collectionName}' not found!`)
			const playlists = col.find(undefined)
			this._collectionData = playlists.find((p) => p.activationId)
			await this._playlistsHandler.setPlaylists(playlists)
			this._dbObserver.added = (id) => {
				void this.changed(id, 'added').catch(this._logger.error)
			}
			this._dbObserver.changed = (id) => {
				void this.changed(id, 'changed').catch(this._logger.error)
			}
		}
	}

	async changed(id: RundownPlaylistId, changeType: string): Promise<void> {
		this.logDocumentChange(id, changeType)
		if (!this._collectionName) return
		const collection = this._core.getCollection(this._collectionName)
		if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
		const playlists = collection.find(undefined)
		await this._playlistsHandler.setPlaylists(playlists)
		this._collectionData = playlists.find((p) => p.activationId)
		await this.notify(this._collectionData)
	}

	get playlistsHandler(): PlaylistsHandler {
		return this._playlistsHandler
	}
}
