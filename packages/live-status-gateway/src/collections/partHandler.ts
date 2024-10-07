import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PartInstancesHandler, SelectedPartInstances } from './partInstancesHandler'
import { PlaylistHandler } from './playlistHandler'
import { PartsHandler } from './partsHandler'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import areElementsShallowEqual from '@sofie-automation/shared-lib/dist/lib/isShallowEqual'

export class PartHandler
	extends CollectionBase<DBPart, CorelibPubSub.parts, CollectionName.Parts>
	implements Collection<DBPart>, CollectionObserver<SelectedPartInstances>, CollectionObserver<DBRundownPlaylist>
{
	public observerName: string
	private _activePlaylist: DBRundownPlaylist | undefined
	private _currentPartInstance: DBPartInstance | undefined

	constructor(logger: Logger, coreHandler: CoreHandler, private _partsHandler: PartsHandler) {
		super(PartHandler.name, CollectionName.Parts, CorelibPubSub.parts, logger, coreHandler)
		this.observerName = this._name
	}

	async changed(id: PartId, changeType: string): Promise<void> {
		this.logDocumentChange(id, changeType)
		if (!this._collectionName) return
		const collection = this._core.getCollection(this._collectionName)
		if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
		const allParts = collection.find(undefined)
		await this._partsHandler.setParts(allParts)
		if (this._collectionData) {
			this._collectionData = collection.findOne(this._collectionData._id)
			await this.notify(this._collectionData)
		}
	}

	async update(source: string, data: DBRundownPlaylist | SelectedPartInstances | undefined): Promise<void> {
		const prevRundownIds = this._activePlaylist?.rundownIdsInOrder ?? []
		const prevCurPartInstance = this._currentPartInstance

		const rundownPlaylist = data ? (data as DBRundownPlaylist) : undefined
		const partInstances = data as SelectedPartInstances
		switch (source) {
			case PlaylistHandler.name:
				this.logUpdateReceived('playlist', source, `rundownPlaylistId ${rundownPlaylist?._id}`)
				this._activePlaylist = rundownPlaylist
				break
			case PartInstancesHandler.name:
				this.logUpdateReceived('partInstances', source)
				this._currentPartInstance = partInstances.current
				break
			default:
				throw new Error(`${this._name} received unsupported update from ${source}}`)
		}

		await new Promise(process.nextTick.bind(this))
		if (!this._collectionName) return
		if (!this._publicationName) return
		const rundownsChanged = !areElementsShallowEqual(this._activePlaylist?.rundownIdsInOrder ?? [], prevRundownIds)
		if (rundownsChanged) {
			if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
			if (this._dbObserver) this._dbObserver.stop()
			if (this._activePlaylist) {
				const rundownIds = this._activePlaylist.rundownIdsInOrder
				this._subscriptionId = await this._coreHandler.setupSubscription(
					this._publicationName,
					rundownIds,
					null
				)
				this._dbObserver = this._coreHandler.setupObserver(this._collectionName)
				this._dbObserver.added = (id) => {
					void this.changed(id, 'added').catch(this._logger.error)
				}
				this._dbObserver.changed = (id) => {
					void this.changed(id, 'changed').catch(this._logger.error)
				}
				this._dbObserver.removed = (id) => {
					void this.changed(id, 'removed').catch(this._logger.error)
				}
			}
		}
		const collection = this._core.getCollection(this._collectionName)
		if (rundownsChanged) {
			const allParts = collection.find(undefined)
			await this._partsHandler.setParts(allParts)
		}
		if (prevCurPartInstance !== this._currentPartInstance) {
			this._logger.debug(
				`${this._name} found updated partInstances with current part ${this._activePlaylist?.currentPartInfo?.partInstanceId}`
			)
			if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
			if (this._currentPartInstance) {
				this._collectionData = collection.findOne(this._currentPartInstance.part._id)
				await this.notify(this._collectionData)
			}
		}
	}
}
