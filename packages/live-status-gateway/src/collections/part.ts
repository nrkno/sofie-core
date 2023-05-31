import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { PartInstanceName } from './partInstances'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

export class PartHandler
	extends CollectionBase<DBPart>
	implements Collection<DBPart>, CollectionObserver<Map<PartInstanceName, DBPartInstance | undefined>>
{
	public observerName: string
	private _core: CoreConnection
	private _activePlaylist: DBRundownPlaylist | undefined
	private _curPartInstance: DBPartInstance | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super('PartHandler', CollectionName.Parts, 'parts', logger, coreHandler)
		this._core = coreHandler.coreConnection
		this.observerName = this._name
	}

	async changed(id: string, changeType: string): Promise<void> {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (!this._collection) return
		const col = this._core.getCollection<DBPart>(this._collection)
		if (!col) throw new Error(`collection '${this._collection}' not found!`)
		if (this._collectionData) {
			this._collectionData = col.findOne(this._collectionData._id)
			await this.notify(this._collectionData)
		}
	}

	async update(
		source: string,
		data: DBRundownPlaylist | Map<PartInstanceName, DBPartInstance | undefined> | undefined
	): Promise<void> {
		const prevPlaylist = this._activePlaylist
		const prevCurPartInstance = this._curPartInstance

		const rundownPlaylist = data ? (data as DBRundownPlaylist) : undefined
		const partInstances = data as Map<PartInstanceName, DBPartInstance | undefined>
		switch (source) {
			case 'PlaylistHandler':
				this._logger.info(`${this._name} received playlist update ${rundownPlaylist?._id}`)
				this._activePlaylist = rundownPlaylist
				break
			case 'PartInstancesHandler':
				this._logger.info(`${this._name} received partInstances update from ${source}`)
				this._curPartInstance = partInstances.get(PartInstanceName.current)
				break
			default:
				throw new Error(`${this._name} received unsupported update from ${source}}`)
		}

		await new Promise(process.nextTick.bind(this))
		if (!this._collection) return
		if (!this._publication) return
		if (prevPlaylist?.rundownIdsInOrder !== this._activePlaylist?.rundownIdsInOrder) {
			if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
			if (this._dbObserver) this._dbObserver.stop()
			if (this._activePlaylist) {
				const rundownIds = this._activePlaylist.rundownIdsInOrder.map((r) => unprotectString(r))
				this._subscriptionId = await this._coreHandler.setupSubscription(
					this._publication,
					rundownIds,
					undefined
				)
				this._dbObserver = this._coreHandler.setupObserver(this._collection)
				this._dbObserver.added = (id: string) => {
					void this.changed(id, 'added').catch(this._logger.error)
				}
				this._dbObserver.changed = (id: string) => {
					void this.changed(id, 'changed').catch(this._logger.error)
				}
			}
		}

		if (prevCurPartInstance !== this._curPartInstance) {
			this._logger.info(
				`${this._name} found updated partInstances with current part ${this._activePlaylist?.currentPartInfo?.partInstanceId}`
			)
			const col = this._core.getCollection<DBPart>(this._collection)
			if (!col) throw new Error(`collection '${this._collection}' not found!`)
			if (this._curPartInstance) {
				this._collectionData = col.findOne(this._curPartInstance.part._id)
				await this.notify(this._collectionData)
			}
		}
	}
}
