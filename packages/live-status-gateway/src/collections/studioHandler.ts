import { Logger } from 'winston'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection } from '../wsHandler'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { StudioId } from '@sofie-automation/server-core-integration'

export class StudioHandler
	extends CollectionBase<DBStudio, CorelibPubSub.studios, CollectionName.Studios>
	implements Collection<DBStudio>
{
	public observerName: string

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(StudioHandler.name, CollectionName.Studios, CorelibPubSub.studios, logger, coreHandler)
		this.observerName = this._name
	}

	async init(): Promise<void> {
		await super.init()
		if (!this._collectionName) return
		if (!this._publicationName) return
		if (!this._studioId) return
		this._subscriptionId = await this._coreHandler.setupSubscription(this._publicationName, [this._studioId])
		this._dbObserver = this._coreHandler.setupObserver(this._collectionName)

		if (this._collectionName) {
			const col = this._core.getCollection(this._collectionName)
			if (!col) throw new Error(`collection '${this._collectionName}' not found!`)
			const studio = col.findOne(this._studioId)
			if (!studio) throw new Error(`studio '${this._studioId}' not found!`)
			this._collectionData = studio
			this._dbObserver.added = (id) => {
				void this.changed(id, 'added').catch(this._logger.error)
			}
			this._dbObserver.changed = (id) => {
				void this.changed(id, 'changed').catch(this._logger.error)
			}
		}
	}

	async changed(id: StudioId, changeType: string): Promise<void> {
		this.logDocumentChange(id, changeType)
		if (!(id === this._studioId && this._collectionName)) return
		const collection = this._core.getCollection(this._collectionName)
		if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
		const studio = collection.findOne(id)
		if (!studio) throw new Error(`studio '${this._studioId}' not found on changed!`)
		this._collectionData = studio
		await this.notify(this._collectionData)
	}
}
