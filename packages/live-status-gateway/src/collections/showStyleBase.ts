import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export class ShowStyleBaseHandler
	extends CollectionBase<DBShowStyleBase>
	implements Collection<DBShowStyleBase>, CollectionObserver<DBRundown>
{
	_observerName: string
	_core: CoreConnection
	_showStyleBaseId: ShowStyleBaseId | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super('ShowStyleBaseHandler', 'showStyleBases', logger, coreHandler)
		this._core = coreHandler.coreConnection
		this._observerName = this._name
	}

	changed(id: string, changeType: string): void {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (!this._collection) return
		const col = this._core.getCollection<DBShowStyleBase>(this._collection)
		if (!col) throw new Error(`collection '${this._collection}' not found!`)
		if (this._showStyleBaseId) {
			this._collectionData = col.findOne(this._showStyleBaseId)
			this.notify(this._collectionData)
		}
	}

	update(source: string, data: DBRundown | undefined): void {
		this._logger.info(
			`${this._name} received rundown update ${data?._id}, showStyleBaseId ${data?.showStyleBaseId} from ${source}`
		)
		const prevShowStyleBaseId = this._showStyleBaseId
		this._showStyleBaseId = data?.showStyleBaseId

		process.nextTick(async () => {
			if (!this._collection) return
			if (prevShowStyleBaseId !== this._showStyleBaseId) {
				if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
				if (this._dbObserver) this._dbObserver.stop()
				if (this._showStyleBaseId) {
					this._subscriptionId = await this._coreHandler.setupSubscription(this._collection, {
						_id: this._showStyleBaseId,
					})
					this._dbObserver = this._coreHandler.setupObserver(this._collection)
					this._dbObserver.added = (id: string) => this.changed(id, 'added')
					this._dbObserver.changed = (id: string) => this.changed(id, 'changed')

					const col = this._core.getCollection<DBShowStyleBase>(this._collection)
					if (!col) throw new Error(`collection '${this._collection}' not found!`)
					this._collectionData = col.findOne(this._showStyleBaseId)
					this.notify(this._collectionData)
				}
			}
		})
	}
}
