import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { Collection, PickArr, PublicationCollection } from '../wsHandler'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { CollectionHandlers } from '../liveStatusServer'

const PLAYLIST_KEYS = ['currentPartInfo', 'nextPartInfo'] as const
type Playlist = PickArr<DBRundownPlaylist, typeof PLAYLIST_KEYS>

export class GlobalAdLibsHandler
	extends PublicationCollection<
		RundownBaselineAdLibItem[],
		CorelibPubSub.rundownBaselineAdLibPieces,
		CollectionName.RundownBaselineAdLibPieces
	>
	implements Collection<RundownBaselineAdLibItem[]>
{
	private _currentRundownId: RundownId | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CollectionName.RundownBaselineAdLibPieces, CorelibPubSub.rundownBaselineAdLibPieces, logger, coreHandler)
	}

	init(handlers: CollectionHandlers): void {
		super.init(handlers)

		handlers.playlistHandler.subscribe(this.onPlaylistUpdate, PLAYLIST_KEYS)
	}

	protected changed(): void {
		this.updateAndNotify()
	}

	private onPlaylistUpdate = (data: Playlist | undefined): void => {
		this.logUpdateReceived('playlist')
		const prevRundownId = this._currentRundownId
		const rundownPlaylist = data

		this._currentRundownId = rundownPlaylist?.currentPartInfo?.rundownId ?? rundownPlaylist?.nextPartInfo?.rundownId

		if (prevRundownId !== this._currentRundownId) {
			this.stopSubscription()
			if (this._currentRundownId) {
				this.setupSubscription([this._currentRundownId])
			}
		}
	}

	private updateAndNotify(): void {
		const collection = this.getCollectionOrFail()
		this._collectionData = collection.find({ rundownId: this._currentRundownId })
		this.notify(this._collectionData)
	}
}
