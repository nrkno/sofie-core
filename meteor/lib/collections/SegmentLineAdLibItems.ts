import { Mongo } from 'meteor/mongo'
import { SegmentLineItemGeneric } from './SegmentLineItems'
import { TransformedCollection } from '../typings/meteor'

export interface SegmentLineAdLibItem extends SegmentLineItemGeneric {
	trigger: undefined
	disabled: false
}

export const SegmentLineAdLibItems: TransformedCollection<SegmentLineAdLibItem, SegmentLineAdLibItem>
	= new Mongo.Collection<SegmentLineAdLibItem>('segmentLineAdLibItems')
