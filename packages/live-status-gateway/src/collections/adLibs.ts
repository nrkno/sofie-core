import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PartInstanceName } from './partInstances'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import _ = require('underscore')
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { PieceId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export class AdLibsHandler
	extends CollectionBase<AdLibPiece[], CorelibPubSub.adLibPieces, CollectionName.AdLibPieces>
	implements Collection<AdLibPiece[]>, CollectionObserver<Map<PartInstanceName, DBPartInstance | undefined>>
{
	public observerName: string
	private _curRundownId: RundownId | undefined
	private _curPartInstance: DBPartInstance | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(AdLibsHandler.name, CollectionName.AdLibPieces, CorelibPubSub.adLibPieces, logger, coreHandler)
		this.observerName = this._name
	}

	async changed(id: PieceId, changeType: string): Promise<void> {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (!this._collectionName) return
		const col = this._core.getCollection(this._collectionName)
		if (!col) throw new Error(`collection '${this._collectionName}' not found!`)
		this._collectionData = col.find({ rundownId: this._curRundownId })
		await this.notify(this._collectionData)
	}

	async update(source: string, data: Map<PartInstanceName, DBPartInstance | undefined> | undefined): Promise<void> {
		this._logger.info(`${this._name} received adLibs update from ${source}`)
		const prevRundownId = this._curRundownId
		const prevCurPartInstance = this._curPartInstance
		this._curPartInstance = data ? data.get(PartInstanceName.current) ?? data.get(PartInstanceName.next) : undefined
		this._curRundownId = this._curPartInstance ? this._curPartInstance.rundownId : undefined

		await new Promise(process.nextTick.bind(this))
		if (!this._collectionName) return
		if (!this._publicationName) return
		if (prevRundownId !== this._curRundownId || !_.isEqual(prevCurPartInstance, this._curPartInstance)) {
			if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
			if (this._dbObserver) this._dbObserver.stop()
			if (this._curRundownId && this._curPartInstance) {
				this._subscriptionId = await this._coreHandler.setupSubscription(this._publicationName, {
					rundownId: this._curRundownId,
				})
				this._dbObserver = this._coreHandler.setupObserver(this._collectionName)
				this._dbObserver.added = (id) => {
					void this.changed(id, 'added').catch(this._logger.error)
				}
				this._dbObserver.changed = (id) => {
					void this.changed(id, 'changed').catch(this._logger.error)
				}

				const collection = this._core.getCollection(this._collectionName)
				if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
				this._collectionData = collection.find({
					rundownId: this._curRundownId,
					partId: this._curPartInstance.part._id,
				})
				await this.notify(this._collectionData)
			}
		}
	}

	// override notify to implement empty array handling
	async notify(data: AdLibPiece[] | undefined): Promise<void> {
		this._logger.info(`${this._name} notifying update with ${data?.length} adLibs`)
		if (data !== undefined) {
			for (const observer of this._observers) {
				await observer.update(this._name, data)
			}
		}
	}
}
