import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, PublicationCollection } from '../wsHandler'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { CollectionHandlers } from '../liveStatusServer'

export class PlaylistsHandler
	extends CollectionBase<DBRundownPlaylist[], CollectionName.RundownPlaylists>
	implements Collection<DBRundownPlaylist[]>
{
	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CollectionName.RundownPlaylists, logger, coreHandler)
	}

	setPlaylists(playlists: DBRundownPlaylist[]): void {
		this.logUpdateReceived('playlists', playlists.length)
		this._collectionData = playlists
		this.notify(this._collectionData)
	}
}

export class PlaylistHandler
	extends PublicationCollection<DBRundownPlaylist, CorelibPubSub.rundownPlaylists, CollectionName.RundownPlaylists>
	implements Collection<DBRundownPlaylist>
{
	private _playlistsHandler: PlaylistsHandler

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CollectionName.RundownPlaylists, CorelibPubSub.rundownPlaylists, logger, coreHandler)
		this._playlistsHandler = new PlaylistsHandler(this._logger, this._coreHandler)
	}

	init(handlers: CollectionHandlers): void {
		super.init(handlers)
		this.setupSubscription(null, [this._studioId])
	}

	changed(): void {
		this.updateAndNotify()
	}

	protected updateAndNotify(): void {
		const collection = this.getCollectionOrFail()
		const playlists = collection.find(undefined)
		this._playlistsHandler.setPlaylists(playlists)

		this.updateAndNotifyActivePlaylist(playlists)
	}

	private updateAndNotifyActivePlaylist(playlists: DBRundownPlaylist[]) {
		const prevActivePlaylist = this._collectionData
		const activePlaylist = playlists.find((p) => p.activationId)
		this._collectionData = activePlaylist
		if (prevActivePlaylist !== activePlaylist) {
			this.notify(this._collectionData)
		}
	}

	get playlistsHandler(): PlaylistsHandler {
		return this._playlistsHandler
	}
}
