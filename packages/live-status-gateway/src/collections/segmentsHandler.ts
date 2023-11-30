import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection } from '../wsHandler'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import * as _ from 'underscore'

const THROTTLE_PERIOD_MS = 200

export class SegmentsHandler extends CollectionBase<DBSegment[]> implements Collection<DBSegment[]> {
	public observerName: string
	private throttledNotify: (data: DBSegment[]) => Promise<void>

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(SegmentsHandler.name, undefined, undefined, logger, coreHandler)
		this.observerName = this._name
		this.throttledNotify = _.throttle(this.notify.bind(this), THROTTLE_PERIOD_MS, { leading: true, trailing: true })
	}

	async setSegments(segments: DBSegment[]): Promise<void> {
		this._logger.info(`'${this._name}' handler received segments update with ${segments.length} segments`)
		this._collectionData = segments
		await this.throttledNotify(this._collectionData)
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
