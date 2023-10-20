import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import isShallowEqual from '@sofie-automation/shared-lib/dist/lib/isShallowEqual'
import _ = require('underscore')

export interface SelectedPartInstances {
	current: DBPartInstance | undefined
	next: DBPartInstance | undefined
	firstInSegmentPlayout: DBPartInstance | undefined
	inCurrentSegment: DBPartInstance[]
}

export class PartInstancesHandler
	extends CollectionBase<SelectedPartInstances>
	implements Collection<SelectedPartInstances>, CollectionObserver<DBRundownPlaylist>
{
	public observerName: string
	private _core: CoreConnection
	private _currentPlaylist: DBRundownPlaylist | undefined
	private _rundownIds: string[] = []
	private _activationId: string | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(PartInstancesHandler.name, CollectionName.PartInstances, 'partInstances', logger, coreHandler)
		this._core = coreHandler.coreConnection
		this.observerName = this._name
		this._collectionData = {
			current: undefined,
			next: undefined,
			firstInSegmentPlayout: undefined,
			inCurrentSegment: [],
		}
	}

	async changed(id: string, changeType: string): Promise<void> {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (!this._collectionName) return
		this.updateCollectionData()

		await this.notify(this._collectionData)
	}

	private updateCollectionData() {
		if (!this._collectionName) return
		const collection = this._core.getCollection<DBPartInstance>(this._collectionName)
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

		this._collectionData = {
			current: currentPartInstance,
			next: nextPartInstance,
			firstInSegmentPlayout: firstPartInstanceInSegmentPlayout,
			inCurrentSegment: partInstancesInSegmentPlayout,
		}
	}

	private clearCollectionData() {
		this._collectionData = {
			current: undefined,
			next: undefined,
			firstInSegmentPlayout: undefined,
			inCurrentSegment: [],
		}
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

		this._rundownIds = this._currentPlaylist
			? this._currentPlaylist.rundownIdsInOrder.map((r) => unprotectString(r))
			: []
		this._activationId = unprotectString(this._currentPlaylist?.activationId)
		if (this._currentPlaylist && this._rundownIds.length && this._activationId) {
			const sameSubscription =
				isShallowEqual(this._rundownIds, prevRundownIds) && prevActivationId === this._activationId
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
				this._dbObserver.added = (id: string) => {
					void this.changed(id, 'added').catch(this._logger.error)
				}
				this._dbObserver.changed = (id: string) => {
					void this.changed(id, 'changed').catch(this._logger.error)
				}

				this.updateCollectionData()
				await this.notify(this._collectionData)
			} else if (this._subscriptionId) {
				this.updateCollectionData()
				await this.notify(this._collectionData)
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
