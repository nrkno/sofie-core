import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection } from '../wsHandler'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import _ = require('underscore')

const THROTTLE_PERIOD_MS = 200

export class PartsHandler extends CollectionBase<DBPart[]> implements Collection<DBPart[]> {
	public observerName: string
	private throttledNotify: (data: DBPart[]) => Promise<void>

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(PartsHandler.name, undefined, undefined, logger, coreHandler)
		this.observerName = this._name
		this.throttledNotify = _.throttle(this.notify.bind(this), THROTTLE_PERIOD_MS, { leading: true, trailing: true })
	}

	async setParts(rundowns: DBPart[]): Promise<void> {
		this._logger.info(`'${this._name}' handler received rundowns update with ${rundowns.length} parts`)
		this._collectionData = rundowns
		await this.throttledNotify(this._collectionData)
	}

	async notify(data: DBPart[] | undefined): Promise<void> {
		this._logger.info(
			`${this._name} notifying all observers of an update with ${this._collectionData?.length} parts`
		)
		if (data !== undefined) {
			for (const observer of this._observers) {
				await observer.update(this._name, data)
			}
		}
	}
}
