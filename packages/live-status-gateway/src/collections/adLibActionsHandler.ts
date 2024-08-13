import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { AdLibActionId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { SelectedPartInstances } from './partInstancesHandler'

export class AdLibActionsHandler
	extends CollectionBase<AdLibAction[], CorelibPubSub.adLibActions, CollectionName.AdLibActions>
	implements Collection<AdLibAction[]>, CollectionObserver<SelectedPartInstances>
{
	public observerName: string
	private _curRundownId: RundownId | undefined
	private _curPartInstance: DBPartInstance | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(AdLibActionsHandler.name, CollectionName.AdLibActions, CorelibPubSub.adLibActions, logger, coreHandler)
		this.observerName = this._name
	}

	async changed(id: AdLibActionId, changeType: string): Promise<void> {
		this.logDocumentChange(id, changeType)
		if (!this._collectionName) return
		const col = this._core.getCollection(this._collectionName)
		if (!col) throw new Error(`collection '${this._collectionName}' not found!`)
		this._collectionData = col.find({ rundownId: this._curRundownId })
		await this.notify(this._collectionData)
	}

	async update(source: string, data: SelectedPartInstances | undefined): Promise<void> {
		this.logUpdateReceived('partInstances', source)
		const prevRundownId = this._curRundownId
		this._curPartInstance = data ? data.current ?? data.next : undefined
		this._curRundownId = this._curPartInstance ? this._curPartInstance.rundownId : undefined

		await new Promise(process.nextTick.bind(this))
		if (!this._collectionName) return
		if (!this._publicationName) return
		if (prevRundownId !== this._curRundownId) {
			if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
			if (this._dbObserver) this._dbObserver.stop()
			if (this._curRundownId && this._curPartInstance) {
				this._subscriptionId = await this._coreHandler.setupSubscription(this._publicationName, [
					this._curRundownId,
				])
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

				const collection = this._core.getCollection(this._collectionName)
				if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
				this._collectionData = collection.find({
					rundownId: this._curRundownId,
				})
				await this.notify(this._collectionData)
			}
		}
	}

	// override notify to implement empty array handling
	async notify(data: AdLibAction[] | undefined): Promise<void> {
		this.logNotifyingUpdate(data?.length)
		if (data !== undefined) {
			for (const observer of this._observers) {
				await observer.update(this._name, data)
			}
		}
	}
}
