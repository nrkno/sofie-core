import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import areElementsShallowEqual from '@sofie-automation/shared-lib/dist/lib/isShallowEqual'
import _ = require('underscore')
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { PartInstanceId, RundownId, RundownPlaylistActivationId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export interface SelectedPartInstances {
	current: DBPartInstance | undefined
	next: DBPartInstance | undefined
	firstInSegmentPlayout: DBPartInstance | undefined
	inCurrentSegment: DBPartInstance[]
}

export class PartInstancesHandler
	extends CollectionBase<SelectedPartInstances, CorelibPubSub.partInstances, CollectionName.PartInstances>
	implements Collection<SelectedPartInstances>, CollectionObserver<DBRundownPlaylist>
{
	public observerName: string
	private _currentPlaylist: DBRundownPlaylist | undefined
	private _rundownIds: RundownId[] = []
	private _activationId: RundownPlaylistActivationId | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(PartInstancesHandler.name, CollectionName.PartInstances, CorelibPubSub.partInstances, logger, coreHandler)
		this.observerName = this._name
		this._collectionData = {
			current: undefined,
			next: undefined,
			firstInSegmentPlayout: undefined,
			inCurrentSegment: [],
		}
	}

	async changed(id: PartInstanceId, changeType: string): Promise<void> {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (!this._collectionName) return
		this.updateCollectionData()

		await this.notify(this._collectionData)
	}

	private updateCollectionData(): boolean {
		if (!this._collectionName || !this._collectionData) return false
		const collection = this._core.getCollection(this._collectionName)
		if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
		const currentPartInstance = this._currentPlaylist?.currentPartInfo?.partInstanceId
			? collection.findOne(this._currentPlaylist.currentPartInfo.partInstanceId)
			: undefined
		const nextPartInstance = this._currentPlaylist?.nextPartInfo?.partInstanceId
			? collection.findOne(this._currentPlaylist.nextPartInfo.partInstanceId)
			: undefined
		const partInstancesInSegmentPlayout = currentPartInstance
			? collection.find({ segmentPlayoutId: currentPartInstance.segmentPlayoutId })
			: []

		const firstPartInstanceInSegmentPlayout = _.min(
			partInstancesInSegmentPlayout,
			(partInstance) => partInstance.takeCount
		) as DBPartInstance

		let hasAnythingChanged = false
		if (currentPartInstance !== this._collectionData.current) {
			this._collectionData.current = currentPartInstance
			hasAnythingChanged = true
		}
		if (this._collectionData.next !== nextPartInstance) {
			this._collectionData.next = nextPartInstance
			hasAnythingChanged = true
		}
		if (this._collectionData.firstInSegmentPlayout !== firstPartInstanceInSegmentPlayout) {
			this._collectionData.firstInSegmentPlayout = firstPartInstanceInSegmentPlayout
			hasAnythingChanged = true
		}
		if (!areElementsShallowEqual(this._collectionData.inCurrentSegment, partInstancesInSegmentPlayout)) {
			this._collectionData.inCurrentSegment = partInstancesInSegmentPlayout
			hasAnythingChanged = true
		}
		return hasAnythingChanged
	}

	private clearCollectionData() {
		if (!this._collectionName || !this._collectionData) return
		this._collectionData.current = undefined
		this._collectionData.next = undefined
		this._collectionData.firstInSegmentPlayout = undefined
		this._collectionData.inCurrentSegment = []
	}

	async update(source: string, data: DBRundownPlaylist | undefined): Promise<void> {
		const prevRundownIds = this._rundownIds.map((rid) => rid)
		const prevActivationId = this._activationId

		this._logger.info(
			`${this._name} received playlist update ${data?._id}, active ${
				data?.activationId ? true : false
			} from ${source}`
		)
		this._currentPlaylist = data
		if (!this._collectionName) return

		this._rundownIds = this._currentPlaylist ? this._currentPlaylist.rundownIdsInOrder : []
		this._activationId = this._currentPlaylist?.activationId
		if (this._currentPlaylist && this._rundownIds.length && this._activationId) {
			const sameSubscription =
				areElementsShallowEqual(this._rundownIds, prevRundownIds) && prevActivationId === this._activationId
			if (!sameSubscription) {
				await new Promise(process.nextTick.bind(this))
				if (!this._collectionName) return
				if (!this._publicationName) return
				if (!this._currentPlaylist) return
				if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
				this._subscriptionId = await this._coreHandler.setupSubscription(
					this._publicationName,
					this._rundownIds,
					this._activationId
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

				const hasAnythingChanged = this.updateCollectionData()
				if (hasAnythingChanged) {
					await this.notify(this._collectionData)
				}
			} else if (this._subscriptionId) {
				const hasAnythingChanged = this.updateCollectionData()
				if (hasAnythingChanged) {
					await this.notify(this._collectionData)
				}
			} else {
				this.clearCollectionData()
				await this.notify(this._collectionData)
			}
		} else {
			this.clearCollectionData()
			await this.notify(this._collectionData)
		}
	}
}