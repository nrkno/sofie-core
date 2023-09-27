import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection } from '../wsHandler'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'

export class SegmentsHandler extends CollectionBase<DBSegment[]> implements Collection<DBSegment[]> {
	public observerName: string

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(SegmentsHandler.name, undefined, undefined, logger, coreHandler)
		this.observerName = this._name
	}

	async setSegments(rundowns: DBSegment[]): Promise<void> {
		this._logger.info(`'${this._name}' handler received segments update with ${rundowns.length} segments`)
		this._collectionData = rundowns
		await this.notify(this._collectionData)
	}

	// override notify to implement empty array handling
	async notify(data: DBSegment[] | undefined): Promise<void> {
		this._logger.info(
			`${this._name} notifying all observers of an update with ${this._collectionData?.length} segments`
		)
		if (data !== undefined) {
			for (const observer of this._observers) {
				await observer.update(this._name, data)
			}
		}
	}
}
