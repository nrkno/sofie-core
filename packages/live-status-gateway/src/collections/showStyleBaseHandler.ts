import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'

export class ShowStyleBaseHandler
	extends CollectionBase<DBShowStyleBase, CorelibPubSub.showStyleBases, CollectionName.ShowStyleBases>
	implements Collection<DBShowStyleBase>, CollectionObserver<DBRundown>
{
	public observerName: string
	private _showStyleBaseId: ShowStyleBaseId | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(
			ShowStyleBaseHandler.name,
			CollectionName.ShowStyleBases,
			CorelibPubSub.showStyleBases,
			logger,
			coreHandler
		)
		this.observerName = this._name
	}

	async changed(id: ShowStyleBaseId, changeType: string): Promise<void> {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (!this._collectionName) return
		const collection = this._core.getCollection(this._collectionName)
		if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
		if (this._showStyleBaseId) {
			this._collectionData = collection.findOne(this._showStyleBaseId)
			await this.notify(this._collectionData)
		}
	}

	async update(source: string, data: DBRundown | undefined): Promise<void> {
		this._logger.info(
			`${this._name} received rundown update ${data?._id}, showStyleBaseId ${data?.showStyleBaseId} from ${source}`
		)
		const prevShowStyleBaseId = this._showStyleBaseId
		this._showStyleBaseId = data?.showStyleBaseId

		await new Promise(process.nextTick.bind(this))
		if (!this._collectionName) return
		if (!this._publicationName) return
		if (prevShowStyleBaseId !== this._showStyleBaseId) {
			if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
			if (this._dbObserver) this._dbObserver.stop()
			if (this._showStyleBaseId) {
				this._subscriptionId = await this._coreHandler.setupSubscription(this._publicationName, [
					this._showStyleBaseId,
				])
				this._dbObserver = this._coreHandler.setupObserver(this._collectionName)
				this._dbObserver.added = (id) => {
					void this.changed(id, 'added').catch(this._logger.error)
				}
				this._dbObserver.changed = (id) => {
					void this.changed(id, 'changed').catch(this._logger.error)
				}

				const collection = this._core.getCollection(this._collectionName)
				if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
				this._collectionData = collection.findOne(this._showStyleBaseId)
				await this.notify(this._collectionData)
			}
		}
	}
}
