import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection } from '../wsHandler'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

export class RundownsHandler
	extends CollectionBase<DBRundown[], undefined, CollectionName.Rundowns>
	implements Collection<DBRundown[]>
{
	public observerName: string

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(RundownsHandler.name, CollectionName.Rundowns, undefined, logger, coreHandler)
		this.observerName = this._name
	}

	async setRundowns(rundowns: DBRundown[]): Promise<void> {
		this.logUpdateReceived('rundowns', rundowns.length)
		this._collectionData = rundowns
		await this.notify(this._collectionData)
	}

	// override notify to implement empty array handling
	async notify(data: DBRundown[] | undefined): Promise<void> {
		this.logNotifyingUpdate(this._collectionData?.length)
		if (data !== undefined) {
			for (const observer of this._observers) {
				await observer.update(this._name, data)
			}
		}
	}
}
