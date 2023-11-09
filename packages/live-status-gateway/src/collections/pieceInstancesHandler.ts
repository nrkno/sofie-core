import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import areElementsShallowEqual from '@sofie-automation/shared-lib/dist/lib/isShallowEqual'
import _ = require('underscore')

export interface SelectedPieceInstances {
	// Pieces reported by the Playout Gateway as active
	active: PieceInstance[]

	// Pieces present in the current part instance
	currentPartInstance: PieceInstance[]

	// Pieces present in the current part instance
	nextPartInstance: PieceInstance[]
}

export class PieceInstancesHandler
	extends CollectionBase<SelectedPieceInstances>
	implements Collection<SelectedPieceInstances>, CollectionObserver<DBRundownPlaylist>
{
	public observerName: string
	private _core: CoreConnection
	private _currentPlaylist: DBRundownPlaylist | undefined
	private _partInstanceIds: string[] = []
	private _activationId: string | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(PieceInstancesHandler.name, CollectionName.PieceInstances, 'pieceInstances', logger, coreHandler)
		this._core = coreHandler.coreConnection
		this.observerName = this._name
		this._collectionData = {
			active: [],
			currentPartInstance: [],
			nextPartInstance: [],
		}
	}

	async changed(id: string, changeType: string): Promise<void> {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (!this._collectionName) return
		this.updateCollectionData()

		await this.notify(this._collectionData)
	}

	private updateCollectionData(): boolean {
		if (!this._collectionName || !this._collectionData) return false
		const collection = this._core.getCollection<PieceInstance>(this._collectionName)
		if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
		const active = this._currentPlaylist?.currentPartInfo?.partInstanceId
			? collection.find(
					(pieceInstance: PieceInstance) =>
						(pieceInstance.partInstanceId === this._currentPlaylist?.previousPartInfo?.partInstanceId ||
							pieceInstance.partInstanceId === this._currentPlaylist?.currentPartInfo?.partInstanceId) &&
						(pieceInstance.reportedStartedPlayback != null ||
							pieceInstance.piece.enable.start === 0 ||
							pieceInstance.infinite?.fromPreviousPart)
			  )
			: []
		const inCurrentPartInstance = this._currentPlaylist?.currentPartInfo?.partInstanceId
			? collection.find({ partInstanceId: this._currentPlaylist.currentPartInfo.partInstanceId })
			: []
		const inNextPartInstance = this._currentPlaylist?.nextPartInfo?.partInstanceId
			? collection.find({ partInstanceId: this._currentPlaylist.nextPartInfo.partInstanceId })
			: []

		let hasAnythingChanged = false
		if (!areElementsShallowEqual(this._collectionData.active, active)) {
			this._collectionData.active = active
			hasAnythingChanged = true
		}
		if (!areElementsShallowEqual(this._collectionData.currentPartInstance, inCurrentPartInstance)) {
			this._collectionData.currentPartInstance = inCurrentPartInstance
			hasAnythingChanged = true
		}
		if (!areElementsShallowEqual(this._collectionData.nextPartInstance, inNextPartInstance)) {
			this._collectionData.nextPartInstance = inNextPartInstance
			hasAnythingChanged = true
		}
		return hasAnythingChanged
	}

	private clearCollectionData() {
		if (!this._collectionName || !this._collectionData) return
		this._collectionData.active = []
		this._collectionData.currentPartInstance = []
		this._collectionData.nextPartInstance = []
	}

	async update(source: string, data: DBRundownPlaylist | undefined): Promise<void> {
		const prevPartInstanceIds = this._partInstanceIds
		const prevActivationId = this._activationId

		this._logger.info(
			`${this._name} received playlist update ${data?._id}, active ${
				data?.activationId ? true : false
			} from ${source}`
		)
		this._currentPlaylist = data
		if (!this._collectionName) return

		this._partInstanceIds = this._currentPlaylist
			? _.compact([
					unprotectString(this._currentPlaylist.previousPartInfo?.partInstanceId),
					unprotectString(this._currentPlaylist.nextPartInfo?.partInstanceId),
					unprotectString(this._currentPlaylist.currentPartInfo?.partInstanceId),
			  ])
			: []
		this._activationId = unprotectString(this._currentPlaylist?.activationId)
		if (this._currentPlaylist && this._partInstanceIds.length && this._activationId) {
			const sameSubscription =
				areElementsShallowEqual(this._partInstanceIds, prevPartInstanceIds) &&
				prevActivationId === this._activationId
			if (!sameSubscription) {
				await new Promise(process.nextTick.bind(this))
				if (!this._collectionName) return
				if (!this._publicationName) return
				if (!this._currentPlaylist) return
				if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
				this._subscriptionId = await this._coreHandler.setupSubscription(this._publicationName, {
					partInstanceId: { $in: this._partInstanceIds },
					playlistActivationId: this._activationId,
					reportedStartedPlayback: { $exists: false },
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
