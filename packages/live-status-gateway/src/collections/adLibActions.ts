import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { PartInstanceName } from './partInstances'

export class AdLibActionsHandler
	extends CollectionBase<AdLibAction[]>
	implements Collection<AdLibAction[]>, CollectionObserver<Map<PartInstanceName, DBPartInstance | undefined>>
{
	_observerName: string
	_core: CoreConnection
	_curRundownId: string | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super('AdLibActionHandler', 'adLibActions', logger, coreHandler)
		this._core = coreHandler.coreConnection
		this._observerName = this._name
	}

	changed(id: string, changeType: string): void {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (!this._collection) return
		const col = this._core.getCollection<AdLibAction>(this._collection)
		if (!col) throw new Error(`collection '${this._collection}' not found!`)
		this._collectionData = col.find(undefined)
		this.notify(this._collectionData)
	}

	update(source: string, data: Map<PartInstanceName, DBPartInstance | undefined> | undefined): void {
		this._logger.info(`${this._name} received partInstances update from ${source}`)
		const prevRundownId = this._curRundownId
		this._curRundownId = data ? unprotectString(data.get(PartInstanceName.cur)?.rundownId) : undefined

		process.nextTick(async () => {
			if (!this._collection) return
			if (prevRundownId !== this._curRundownId) {
				if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
				if (this._dbObserver) this._dbObserver.stop()
				if (this._curRundownId) {
					this._subscriptionId = await this._coreHandler.setupSubscription(this._collection, {
						rundownId: this._curRundownId,
					})
					this._dbObserver = this._coreHandler.setupObserver(this._collection)
					this._dbObserver.added = (id: string) => this.changed(id, 'added')
					this._dbObserver.changed = (id: string) => this.changed(id, 'changed')

					const col = this._core.getCollection<AdLibAction>(this._collection)
					if (!col) throw new Error(`collection '${this._collection}' not found!`)
					this._collectionData = col.find(undefined)
					this.notify(this._collectionData)
				}
			}
		})
	}

	// override notify to implement empty array handling
	notify(data: AdLibAction[] | undefined): void {
		this._logger.info(`${this._name} notifying update with ${data?.length} adLibActions`)
		this._observers.forEach((o) => (data ? o.update(this._name, data) : []))
	}
}
