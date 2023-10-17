import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import isShallowEqual from '@sofie-automation/shared-lib/dist/lib/isShallowEqual'

export enum PartInstanceName {
	current = 'current',
	next = 'next',
}

export class PartInstancesHandler
	extends CollectionBase<Map<PartInstanceName, DBPartInstance | undefined>>
	implements Collection<Map<PartInstanceName, DBPartInstance | undefined>>, CollectionObserver<DBRundownPlaylist>
{
	public observerName: string
	private _core: CoreConnection
	private _curPlaylist: DBRundownPlaylist | undefined
	private _rundownIds: string[] = []
	private _activationId: string | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(PartInstancesHandler.name, CollectionName.PartInstances, 'partInstances', logger, coreHandler)
		this._core = coreHandler.coreConnection
		this.observerName = this._name
		this._collectionData = new Map()
		this._collectionData.set(PartInstanceName.current, undefined)
		this._collectionData.set(PartInstanceName.next, undefined)
	}

	async changed(id: string, changeType: string): Promise<void> {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (!this._collectionName) return
		const collection = this._core.getCollection<DBPartInstance>(this._collectionName)
		if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
		const curPartInstance = this._curPlaylist?.currentPartInfo?.partInstanceId
			? collection.findOne(this._curPlaylist.currentPartInfo.partInstanceId)
			: undefined
		const nextPartInstance = this._curPlaylist?.nextPartInfo?.partInstanceId
			? collection.findOne(this._curPlaylist.nextPartInfo.partInstanceId)
			: undefined
		this._collectionData?.forEach((_pi, key) => {
			if (PartInstanceName.current === key) this._collectionData?.set(key, curPartInstance)
			else if (PartInstanceName.next === key) this._collectionData?.set(key, nextPartInstance)
		})

		await this.notify(this._collectionData)
	}

	async update(source: string, data: DBRundownPlaylist | undefined): Promise<void> {
		const prevRundownIds = this._rundownIds.map((rid) => rid)
		const prevActivationId = this._activationId

		this._logger.info(
			`${this._name} received playlist update ${data?._id}, active ${
				data?.activationId ? true : false
			} from ${source}`
		)
		this._curPlaylist = data
		if (!this._collectionName) return

		this._rundownIds = this._curPlaylist ? this._curPlaylist.rundownIdsInOrder.map((r) => unprotectString(r)) : []
		this._activationId = unprotectString(this._curPlaylist?.activationId)
		if (this._curPlaylist && this._rundownIds.length && this._activationId) {
			const sameSubscription =
				isShallowEqual(this._rundownIds, prevRundownIds) && prevActivationId === this._activationId
			if (!sameSubscription) {
				await new Promise(process.nextTick.bind(this))
				if (!this._collectionName) return
				if (!this._publicationName) return
				if (!this._curPlaylist) return
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

				const collection = this._core.getCollection<DBPartInstance>(this._collectionName)
				if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
				const curPartInstance = this._curPlaylist?.currentPartInfo?.partInstanceId
					? collection.findOne(this._curPlaylist.currentPartInfo.partInstanceId)
					: undefined
				const nextPartInstance = this._curPlaylist?.nextPartInfo?.partInstanceId
					? collection.findOne(this._curPlaylist.nextPartInfo.partInstanceId)
					: undefined
				this._collectionData?.forEach((_pi, key) => {
					if (PartInstanceName.current === key) this._collectionData?.set(key, curPartInstance)
					else if (PartInstanceName.next === key) this._collectionData?.set(key, nextPartInstance)
				})
				await this.notify(this._collectionData)
			} else if (this._subscriptionId) {
				const collection = this._core.getCollection<DBPartInstance>(this._collectionName)
				if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
				const curPartInstance = this._curPlaylist?.currentPartInfo?.partInstanceId
					? collection.findOne(this._curPlaylist.currentPartInfo.partInstanceId)
					: undefined
				const nextPartInstance = this._curPlaylist.nextPartInfo?.partInstanceId
					? collection.findOne(this._curPlaylist.nextPartInfo.partInstanceId)
					: undefined
				this._collectionData?.forEach((_pi, key) => {
					if (PartInstanceName.current === key) this._collectionData?.set(key, curPartInstance)
					else if (PartInstanceName.next === key) this._collectionData?.set(key, nextPartInstance)
				})
				await this.notify(this._collectionData)
			} else {
				this._collectionData?.forEach((_pi, key) => this._collectionData?.set(key, undefined))
				await this.notify(this._collectionData)
			}
		} else {
			this._collectionData?.forEach((_pi, key) => this._collectionData?.set(key, undefined))
			await this.notify(this._collectionData)
		}
	}
}
