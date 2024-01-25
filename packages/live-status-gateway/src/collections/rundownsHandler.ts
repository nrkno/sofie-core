import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection } from '../wsHandler'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'

export class RundownsHandler
	extends CollectionBase<DBRundown[], undefined, undefined>
	implements Collection<DBRundown[]>
{
	public observerName: string

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(RundownsHandler.name, undefined, undefined, logger, coreHandler)
		this.observerName = this._name
	}

	async setRundowns(rundowns: DBRundown[]): Promise<void> {
		this._logger.info(`'${this._name}' handler received rundowns update with ${rundowns.length} rundowns`)
		this._collectionData = rundowns
		await this.notify(this._collectionData)
	}

	// override notify to implement empty array handling
	async notify(data: DBRundown[] | undefined): Promise<void> {
		this._logger.info(
			`${this._name} notifying all observers of an update with ${this._collectionData?.length} rundowns`
		)
		if (data !== undefined) {
			for (const observer of this._observers) {
				await observer.update(this._name, data)
			}
		}
	}
}
