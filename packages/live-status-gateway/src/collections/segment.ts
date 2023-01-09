import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PartInstanceName } from './partInstances'
import { RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export class SegmentHandler
	extends CollectionBase<DBSegment>
	implements Collection<DBSegment>, CollectionObserver<Map<PartInstanceName, DBPartInstance | undefined>>
{
	_observerName: string
	_core: CoreConnection
	_curRundownId: RundownId | undefined
	_curSegmentId: SegmentId | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super('SegmentHandler', 'segments', logger, coreHandler)
		this._core = coreHandler.coreConnection
		this._observerName = this._name
	}

	changed(id: string, changeType: string): void {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (!this._collection) return
		const col = this._core.getCollection<DBSegment>(this._collection)
		if (!col) throw new Error(`collection '${this._collection}' not found!`)
		if (this._curSegmentId) {
			this._collectionData = col.findOne(this._curSegmentId)
			this.notify(this._collectionData)
		}
	}

	update(source: string, data: Map<PartInstanceName, DBPartInstance | undefined> | undefined): void {
		this._logger.info(`${this._name} received partInstances update from ${source}`)
		const prevRundownId = this._curRundownId
		const prevSegmentId = this._curSegmentId
		this._curRundownId = data ? data.get(PartInstanceName.cur)?.rundownId : undefined
		this._curSegmentId = data ? data.get(PartInstanceName.cur)?.segmentId : undefined

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
				}
			}

			if (prevSegmentId !== this._curSegmentId) {
				const col = this._core.getCollection<DBSegment>(this._collection)
				if (!col) throw new Error(`collection '${this._collection}' not found!`)
				if (this._curSegmentId) {
					this._collectionData = col.findOne(this._curSegmentId)
					this.notify(this._collectionData)
				}
			}
		})
	}
}
