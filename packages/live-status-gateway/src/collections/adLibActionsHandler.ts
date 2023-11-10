import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { SelectedPartInstances } from './partInstancesHandler'

export class AdLibActionsHandler
	extends CollectionBase<AdLibAction[]>
	implements Collection<AdLibAction[]>, CollectionObserver<SelectedPartInstances>
{
	public observerName: string
	private _core: CoreConnection
	private _curRundownId: string | undefined
	private _curPartInstance: DBPartInstance | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(AdLibActionsHandler.name, CollectionName.AdLibActions, 'adLibActions', logger, coreHandler)
		this._core = coreHandler.coreConnection
		this.observerName = this._name
	}

	async changed(id: string, changeType: string): Promise<void> {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (!this._collectionName) return
		const col = this._core.getCollection<AdLibAction>(this._collectionName)
		if (!col) throw new Error(`collection '${this._collectionName}' not found!`)
		this._collectionData = col.find({ rundownId: this._curRundownId })
		await this.notify(this._collectionData)
	}

	async update(source: string, data: SelectedPartInstances | undefined): Promise<void> {
		this._logger.info(`${this._name} received partInstances update from ${source}`)
		const prevRundownId = this._curRundownId
		this._curPartInstance = data ? data.current ?? data.next : undefined
		this._curRundownId = this._curPartInstance ? unprotectString(this._curPartInstance.rundownId) : undefined

		await new Promise(process.nextTick.bind(this))
		if (!this._collectionName) return
		if (!this._publicationName) return
		if (prevRundownId !== this._curRundownId) {
			if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
			if (this._dbObserver) this._dbObserver.stop()
			if (this._curRundownId && this._curPartInstance) {
				this._subscriptionId = await this._coreHandler.setupSubscription(this._publicationName, {
					rundownId: this._curRundownId,
				})
				this._dbObserver = this._coreHandler.setupObserver(this._collectionName)
				this._dbObserver.added = (id: string) => {
					void this.changed(id, 'added').catch(this._logger.error)
				}
				this._dbObserver.changed = (id: string) => {
					void this.changed(id, 'changed').catch(this._logger.error)
				}
				this._dbObserver.removed = (id: string) => {
					void this.changed(id, 'removed').catch(this._logger.error)
				}

				const collection = this._core.getCollection<AdLibAction>(this._collectionName)
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
		this._logger.info(`${this._name} notifying update with ${data?.length} adLibActions`)
		if (data !== undefined) {
			for (const observer of this._observers) {
				await observer.update(this._name, data)
			}
		}
	}
}
