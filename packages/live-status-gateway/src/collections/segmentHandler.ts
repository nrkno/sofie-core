import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { PartInstancesHandler, SelectedPartInstances } from './partInstancesHandler'
import { RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import areElementsShallowEqual from '@sofie-automation/shared-lib/dist/lib/isShallowEqual'
import { SegmentsHandler } from './segmentsHandler'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PlaylistHandler } from './playlistHandler'

export class SegmentHandler
	extends CollectionBase<DBSegment>
	implements Collection<DBSegment>, CollectionObserver<SelectedPartInstances>, CollectionObserver<DBRundownPlaylist>
{
	public observerName: string
	private _core: CoreConnection
	private _currentSegmentId: SegmentId | undefined
	private _rundownIds: RundownId[] = []

	constructor(logger: Logger, coreHandler: CoreHandler, private _segmentsHandler: SegmentsHandler) {
		super(SegmentHandler.name, CollectionName.Segments, 'segments', logger, coreHandler)
		this._core = coreHandler.coreConnection
		this.observerName = this._name
	}

	async changed(id: string, changeType: string): Promise<void> {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (!this._collectionName) return
		const collection = this._core.getCollection<DBSegment>(this._collectionName)
		if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
		const allSegments = collection.find(undefined)
		await this._segmentsHandler.setSegments(allSegments)
		if (this._currentSegmentId) {
			this._collectionData = collection.findOne(this._currentSegmentId)
			await this.notify(this._collectionData)
		}
	}

	async update(source: string, data: SelectedPartInstances | DBRundownPlaylist | undefined): Promise<void> {
		const previousSegmentId = this._currentSegmentId
		const previousRundownIds = this._rundownIds

		switch (source) {
			case PartInstancesHandler.name: {
				this._logger.info(`${this._name} received update from ${source}`)
				const partInstanceMap = data as SelectedPartInstances
				this._currentSegmentId = data ? partInstanceMap.current?.segmentId : undefined
				break
			}
			case PlaylistHandler.name: {
				this._logger.info(`${this._name} received update from ${source}`)
				this._rundownIds = (data as DBRundownPlaylist | undefined)?.rundownIdsInOrder ?? []
				break
			}
			default:
				throw new Error(`${this._name} received unsupported update from ${source}}`)
		}
		await new Promise(process.nextTick.bind(this))
		if (!this._collectionName) return
		if (!this._publicationName) return

		const rundownsChanged = !areElementsShallowEqual(this._rundownIds, previousRundownIds)
		if (rundownsChanged) {
			if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
			if (this._dbObserver) this._dbObserver.stop()
			if (this._rundownIds.length) {
				this._subscriptionId = await this._coreHandler.setupSubscription(this._publicationName, {
					rundownId: { $in: this._rundownIds },
					isHidden: { $ne: true },
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
			}
		}

		const collection = this._core.getCollection<DBSegment>(this._collectionName)
		if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
		if (rundownsChanged) {
			const allSegments = collection.find(undefined)
			await this._segmentsHandler.setSegments(allSegments)
		}
		if (previousSegmentId !== this._currentSegmentId) {
			if (this._currentSegmentId) {
				this._collectionData = collection.findOne(this._currentSegmentId)
				await this.notify(this._collectionData)
			}
		}
	}
}
