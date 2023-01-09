import { Logger } from 'winston'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection } from '../wsHandler'
import { protectString, unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'

export class StudioHandler extends CollectionBase<DBStudio> implements Collection<DBStudio> {
	_observerName: string
	_core: CoreConnection

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super('StudioHandler', 'studios', logger, coreHandler)
		this._core = coreHandler.coreConnection
		this._observerName = this._name
	}

	async init(): Promise<void> {
		await super.init()
		if (!(this._studioId && this._collection)) return
		this._subscriptionId = await this._coreHandler.setupSubscription(this._collection, { _id: this._studioId })
		this._dbObserver = this._coreHandler.setupObserver(this._collection)

		if (this._collection) {
			const col = this._core.getCollection<DBStudio>(this._collection)
			if (!col) throw new Error(`collection '${this._collection}' not found!`)
			const studio = col.findOne(this._studioId)
			if (!studio) throw new Error(`studio '${this._studioId}' not found!`)
			this._collectionData = studio
			this._dbObserver.added = (id: string) => this.changed(id, 'added')
			this._dbObserver.changed = (id: string) => this.changed(id, 'changed')
		}
	}

	changed(id: string, changeType: string): void {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (!(id === unprotectString(this._studioId) && this._collection)) return
		const col = this._core.getCollection<DBStudio>(this._collection)
		if (!col) throw new Error(`collection '${this._collection}' not found!`)
		const studio = col.findOne(protectString(id))
		if (!studio) throw new Error(`studio '${this._studioId}' not found on changed!`)
		this._collectionData = studio
		this.notify(this._collectionData)
	}
}
