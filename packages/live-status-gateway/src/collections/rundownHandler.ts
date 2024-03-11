import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { PartInstancesHandler, SelectedPartInstances } from './partInstancesHandler'
import { RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { PlaylistHandler } from './playlistHandler'
import { RundownsHandler } from './rundownsHandler'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'

export class RundownHandler
	extends CollectionBase<DBRundown, CorelibPubSub.rundownsInPlaylists, CollectionName.Rundowns>
	implements Collection<DBRundown>, CollectionObserver<DBRundownPlaylist>, CollectionObserver<SelectedPartInstances>
{
	public observerName: string
	private _currentPlaylistId: RundownPlaylistId | undefined
	private _currentRundownId: RundownId | undefined

	constructor(logger: Logger, coreHandler: CoreHandler, private _rundownsHandler?: RundownsHandler) {
		super(RundownHandler.name, CollectionName.Rundowns, CorelibPubSub.rundownsInPlaylists, logger, coreHandler)
		this.observerName = this._name
	}

	async changed(id: RundownId, changeType: string): Promise<void> {
		this.logDocumentChange(id, changeType)
		if (id !== this._currentRundownId)
			throw new Error(`${this._name} received change with unexpected id ${id} !== ${this._currentRundownId}`)
		if (!this._collectionName) return
		const collection = this._core.getCollection(this._collectionName)
		if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
		await this._rundownsHandler?.setRundowns(collection.find(undefined))
		if (this._collectionData) this._collectionData = collection.findOne(this._collectionData._id)
		await this.notify(this._collectionData)
	}

	async update(source: string, data: DBRundownPlaylist | SelectedPartInstances | undefined): Promise<void> {
		const prevPlaylistId = this._currentPlaylistId
		const prevCurRundownId = this._currentRundownId
		const rundownPlaylist = data ? (data as DBRundownPlaylist) : undefined
		const partInstances = data as SelectedPartInstances
		switch (source) {
			case PlaylistHandler.name:
				this.logUpdateReceived('playlist', source, unprotectString(rundownPlaylist?._id))
				this._currentPlaylistId = rundownPlaylist?._id
				break
			case PartInstancesHandler.name:
				this.logUpdateReceived('partInstances', source)
				this._currentRundownId = partInstances.current?.rundownId ?? partInstances.next?.rundownId
				break
			default:
				throw new Error(`${this._name} received unsupported update from ${source}}`)
		}

		await new Promise(process.nextTick.bind(this))
		if (!this._collectionName) return
		if (!this._publicationName) return
		if (prevPlaylistId !== this._currentPlaylistId) {
			if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
			if (this._dbObserver) this._dbObserver.stop()
			if (this._currentPlaylistId) {
				this._subscriptionId = await this._coreHandler.setupSubscription(this._publicationName, [
					this._currentPlaylistId,
				])
				this._dbObserver = this._coreHandler.setupObserver(this._collectionName)
				this._dbObserver.added = (id) => {
					void this.changed(id, 'added').catch(this._logger.error)
				}
				this._dbObserver.changed = (id) => {
					void this.changed(id, 'changed').catch(this._logger.error)
				}
			}
		}

		if (prevCurRundownId !== this._currentPlaylistId) {
			const currentPlaylistId = this._currentRundownId
			if (currentPlaylistId) {
				const collection = this._core.getCollection(this._collectionName)
				if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
				const rundown = collection.findOne(currentPlaylistId)
				if (!rundown) throw new Error(`rundown '${currentPlaylistId}' not found!`)
				this._collectionData = rundown
			} else this._collectionData = undefined
			await this.notify(this._collectionData)
		}
	}
}
