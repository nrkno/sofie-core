import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { Collection } from '../wsHandler'
import { PublicationCollection } from '../publicationCollection'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { CollectionHandlers } from '../liveStatusServer'
import { PickKeys } from '@sofie-automation/shared-lib/dist/lib/types'

const PLAYLIST_KEYS = ['currentPartInfo', 'nextPartInfo'] as const
type Playlist = PickKeys<DBRundownPlaylist, typeof PLAYLIST_KEYS>

export class AdLibActionsHandler
	extends PublicationCollection<AdLibAction[], CorelibPubSub.adLibActions, CollectionName.AdLibActions>
	implements Collection<AdLibAction[]>
{
	private _currentRundownId: RundownId | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CollectionName.AdLibActions, CorelibPubSub.adLibActions, logger, coreHandler)
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
			// no need to trigger updateAndNotify() because the subscription will take care of this
		}
	}

	private updateAndNotify(): void {
		const col = this.getCollectionOrFail()
		this._collectionData = col.find({ rundownId: this._currentRundownId })
		this.notify(this._collectionData)
	}
}
