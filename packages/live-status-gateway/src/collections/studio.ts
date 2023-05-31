import { Logger } from 'winston'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection } from '../wsHandler'
import { protectString, unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

export class StudioHandler extends CollectionBase<DBStudio> implements Collection<DBStudio> {
	public observerName: string
	private _core: CoreConnection

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super('StudioHandler', CollectionName.Studios, 'studios', logger, coreHandler)
		this._core = coreHandler.coreConnection
		this.observerName = this._name
	}

	async init(): Promise<void> {
		await super.init()
		if (!this._collection) return
		if (!this._publication) return
		if (!this._studioId) return
		this._subscriptionId = await this._coreHandler.setupSubscription(this._publication, { _id: this._studioId })
		this._dbObserver = this._coreHandler.setupObserver(this._collection)

		if (this._collection) {
			const col = this._core.getCollection<DBStudio>(this._collection)
			if (!col) throw new Error(`collection '${this._collection}' not found!`)
			const studio = col.findOne(this._studioId)
			if (!studio) throw new Error(`studio '${this._studioId}' not found!`)
			this._collectionData = studio
			this._dbObserver.added = (id: string) => {
				void this.changed(id, 'added').catch(this._logger.error)
			}
			this._dbObserver.changed = (id: string) => {
				void this.changed(id, 'changed').catch(this._logger.error)
			}
		}
	}

	async changed(id: string, changeType: string): Promise<void> {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (!(id === unprotectString(this._studioId) && this._collection)) return
		const col = this._core.getCollection<DBStudio>(this._collection)
		if (!col) throw new Error(`collection '${this._collection}' not found!`)
		const studio = col.findOne(protectString(id))
		if (!studio) throw new Error(`studio '${this._studioId}' not found on changed!`)
		this._collectionData = studio
		await this.notify(this._collectionData)
	}
}
