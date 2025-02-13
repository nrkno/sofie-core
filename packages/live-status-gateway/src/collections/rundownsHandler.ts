import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { Collection } from '../wsHandler'
import { CollectionBase } from '../collectionBase'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

export class RundownsHandler
	extends CollectionBase<DBRundown[], CollectionName.Rundowns>
	implements Collection<DBRundown[]>
{
	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CollectionName.Rundowns, logger, coreHandler)
	}

	setRundowns(rundowns: DBRundown[]): void {
		this.logUpdateReceived('rundowns', rundowns.length)
		this._collectionData = rundowns
		this.notify(this._collectionData)
	}
}
