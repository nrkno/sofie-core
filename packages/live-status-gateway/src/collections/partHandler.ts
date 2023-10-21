import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { PartInstancesHandler, SelectedPartInstances } from './partInstancesHandler'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { PlaylistHandler } from './playlistHandler'
import areElementsShallowEqual from '@sofie-automation/shared-lib/dist/lib/isShallowEqual'
import { PartsHandler } from './partsHandler'

export class PartHandler
	extends CollectionBase<DBPart>
	implements Collection<DBPart>, CollectionObserver<SelectedPartInstances>, CollectionObserver<DBRundownPlaylist>
{
	public observerName: string
	private _core: CoreConnection
	private _activePlaylist: DBRundownPlaylist | undefined
	private _currentPartInstance: DBPartInstance | undefined

	constructor(logger: Logger, coreHandler: CoreHandler, private _partsHandler: PartsHandler) {
		super(PartHandler.name, CollectionName.Parts, 'parts', logger, coreHandler)
		this._core = coreHandler.coreConnection
		this.observerName = this._name
	}

	async changed(id: string, changeType: string): Promise<void> {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (!this._collectionName) return
		const collection = this._core.getCollection<DBPart>(this._collectionName)
		if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
		const allParts = collection.find(undefined)
		await this._partsHandler.setParts(allParts)
		if (this._collectionData) {
			this._collectionData = collection.findOne(this._collectionData._id)
			await this.notify(this._collectionData)
		}
	}

	async update(source: string, data: DBRundownPlaylist | SelectedPartInstances | undefined): Promise<void> {
		const prevRundownIds = this._activePlaylist?.rundownIdsInOrder ?? []
		const prevCurPartInstance = this._currentPartInstance

		const rundownPlaylist = data ? (data as DBRundownPlaylist) : undefined
		const partInstances = data as SelectedPartInstances
		switch (source) {
			case PlaylistHandler.name:
				this._logger.info(`${this._name} received playlist update ${rundownPlaylist?._id}`)
				this._activePlaylist = rundownPlaylist
				break
			case PartInstancesHandler.name:
				this._logger.info(`${this._name} received partInstances update from ${source}`)
				this._currentPartInstance = partInstances.current
				break
			default:
				throw new Error(`${this._name} received unsupported update from ${source}}`)
		}

		await new Promise(process.nextTick.bind(this))
		if (!this._collectionName) return
		if (!this._publicationName) return
		const rundownsChanged = !areElementsShallowEqual(this._activePlaylist?.rundownIdsInOrder ?? [], prevRundownIds)
		if (rundownsChanged) {
			if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
			if (this._dbObserver) this._dbObserver.stop()
			if (this._activePlaylist) {
				const rundownIds = this._activePlaylist?.rundownIdsInOrder.map((r) => unprotectString(r))
				this._subscriptionId = await this._coreHandler.setupSubscription(
					this._publicationName,
					rundownIds,
					undefined
				)
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
		const collection = this._core.getCollection<DBPart>(this._collectionName)
		if (rundownsChanged) {
			const allParts = collection.find(undefined)
			await this._partsHandler.setParts(allParts)
		}
		if (prevCurPartInstance !== this._currentPartInstance) {
			this._logger.info(
				`${this._name} found updated partInstances with current part ${this._activePlaylist?.currentPartInfo?.partInstanceId}`
			)
			if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
			if (this._currentPartInstance) {
				this._collectionData = collection.findOne(this._currentPartInstance.part._id)
				await this.notify(this._collectionData)
			}
		}
	}
}
