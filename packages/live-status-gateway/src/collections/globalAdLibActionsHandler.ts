import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { SelectedPartInstances } from './partInstancesHandler'

export class GlobalAdLibActionsHandler
	extends CollectionBase<RundownBaselineAdLibAction[]>
	implements Collection<RundownBaselineAdLibAction[]>, CollectionObserver<SelectedPartInstances>
{
	public observerName: string
	private _core: CoreConnection
	private _currentRundownId: string | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(
			GlobalAdLibActionsHandler.name,
			CollectionName.RundownBaselineAdLibActions,
			'rundownBaselineAdLibActions',
			logger,
			coreHandler
		)
		this._core = coreHandler.coreConnection
		this.observerName = this._name
	}

	async changed(id: string, changeType: string): Promise<void> {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (!this._collectionName) return
		const col = this._core.getCollection<RundownBaselineAdLibAction>(this._collectionName)
		if (!col) throw new Error(`collection '${this._collectionName}' not found!`)
		this._collectionData = col.find({ rundownId: this._currentRundownId })
		await this.notify(this._collectionData)
	}

	async update(source: string, data: SelectedPartInstances | undefined): Promise<void> {
		this._logger.info(`${this._name} received partInstances update from ${source}`)
		const prevRundownId = this._currentRundownId
		const partInstance = data ? data.current ?? data.next : undefined
		this._currentRundownId = partInstance ? unprotectString(partInstance.rundownId) : undefined

		await new Promise(process.nextTick.bind(this))
		if (!this._collectionName) return
		if (!this._publicationName) return
		if (prevRundownId !== this._currentRundownId) {
			if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
			if (this._dbObserver) this._dbObserver.stop()
			if (this._currentRundownId) {
				this._subscriptionId = await this._coreHandler.setupSubscription(this._publicationName, {
					rundownId: this._currentRundownId,
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

				const collection = this._core.getCollection<RundownBaselineAdLibAction>(this._collectionName)
				if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
				this._collectionData = collection.find({ rundownId: this._currentRundownId })
				await this.notify(this._collectionData)
			}
		}
	}

	// override notify to implement empty array handling
	async notify(data: RundownBaselineAdLibAction[] | undefined): Promise<void> {
		this._logger.info(`${this._name} notifying update with ${data?.length} globalAdLibActions`)
		if (data !== undefined) {
			for (const observer of this._observers) {
				await observer.update(this._name, data)
			}
		}
	}
}
