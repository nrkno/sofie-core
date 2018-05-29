import { SegmentLineItemGeneric } from './SegmentLineItems'
import { TransformedCollection } from './typings'

export interface SegmentLineAdLibItem extends SegmentLineItemGeneric {
	trigger: undefined
	disabled: false
}

// @ts-ignore
export const SegmentLineAdLibItems: TransformedCollection<SegmentLineAdLibItem, SegmentLineAdLibItem>
// @ts-ignore
	= new Mongo.Collection<SegmentLineAdLibItem>('segmentLineAdLibItems')
