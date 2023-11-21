import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PartInstanceName, PartInstancesHandler } from './partInstances'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { PlaylistHandler } from './playlist'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export class PartHandler
	extends CollectionBase<DBPart, CorelibPubSub.parts, CollectionName.Parts>
	implements Collection<DBPart>, CollectionObserver<Map<PartInstanceName, DBPartInstance | undefined>>
{
	public observerName: string
	private _activePlaylist: DBRundownPlaylist | undefined
	private _curPartInstance: DBPartInstance | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(PartHandler.name, CollectionName.Parts, CorelibPubSub.parts, logger, coreHandler)
		this.observerName = this._name
	}

	async changed(id: PartId, changeType: string): Promise<void> {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (!this._collectionName) return
		const col = this._core.getCollection(this._collectionName)
		if (!col) throw new Error(`collection '${this._collectionName}' not found!`)
		if (this._collectionData) {
			this._collectionData = col.findOne(this._collectionData._id)
			await this.notify(this._collectionData)
		}
	}

	async update(
		source: string,
		data: DBRundownPlaylist | Map<PartInstanceName, DBPartInstance | undefined> | undefined
	): Promise<void> {
		const prevPlaylist = this._activePlaylist
		const prevCurPartInstance = this._curPartInstance

		const rundownPlaylist = data ? (data as DBRundownPlaylist) : undefined
		const partInstances = data as Map<PartInstanceName, DBPartInstance | undefined>
		switch (source) {
			case PlaylistHandler.name:
				this._logger.info(`${this._name} received playlist update ${rundownPlaylist?._id}`)
				this._activePlaylist = rundownPlaylist
				break
			case PartInstancesHandler.name:
				this._logger.info(`${this._name} received partInstances update from ${source}`)
				this._curPartInstance = partInstances.get(PartInstanceName.current)
				break
			default:
				throw new Error(`${this._name} received unsupported update from ${source}}`)
		}

		await new Promise(process.nextTick.bind(this))
		if (!this._collectionName) return
		if (!this._publicationName) return
		if (prevPlaylist?.rundownIdsInOrder !== this._activePlaylist?.rundownIdsInOrder) {
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
			}
		}

		if (prevCurPartInstance !== this._curPartInstance) {
			this._logger.info(
				`${this._name} found updated partInstances with current part ${this._activePlaylist?.currentPartInfo?.partInstanceId}`
			)
			const collection = this._core.getCollection(this._collectionName)
			if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
			if (this._curPartInstance) {
				this._collectionData = collection.findOne(this._curPartInstance.part._id)
				await this.notify(this._collectionData)
			}
		}
	}
}
