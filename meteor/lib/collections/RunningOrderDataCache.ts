import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import { RundownAPI } from '../../lib/api/rundown'
import { Time, applyClassToDocument } from '../../lib/lib'
import { Segments, DBSegment, Segment } from './Segments'
import { SegmentLines, SegmentLine } from './SegmentLines'
import { FindOptions, Selector, TransformedCollection } from '../typings/meteor'

export interface RunningOrderDataCacheObj {
	_id: string,
	modified: number,
	/** Id of the Running Order */
	roId: string,
	data: any
}

export const RunningOrderDataCache: TransformedCollection<RunningOrderDataCacheObj, RunningOrderDataCacheObj>
	= new Mongo.Collection<RunningOrderDataCacheObj>('runningorderdatacache')
