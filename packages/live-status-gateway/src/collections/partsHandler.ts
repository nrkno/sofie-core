import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection } from '../wsHandler'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import _ = require('underscore')
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

const THROTTLE_PERIOD_MS = 200

export class PartsHandler
	extends CollectionBase<DBPart[], CorelibPubSub.parts, CollectionName.Parts>
	implements Collection<DBPart[]>
{
	public observerName: string
	private throttledNotify: (data: DBPart[]) => Promise<void>

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(PartsHandler.name, CollectionName.Parts, CorelibPubSub.parts, logger, coreHandler)
		this.observerName = this._name
		this.throttledNotify = _.throttle(this.notify.bind(this), THROTTLE_PERIOD_MS, { leading: true, trailing: true })
	}

	async setParts(parts: DBPart[]): Promise<void> {
		this.logUpdateReceived('parts', parts.length)
		this._collectionData = parts
		await this.throttledNotify(this._collectionData)
	}

	async notify(data: DBPart[] | undefined): Promise<void> {
		this.logNotifyingUpdate(this._collectionData?.length)
		if (data !== undefined) {
			for (const observer of this._observers) {
				await observer.update(this._name, data)
			}
		}
	}
}
