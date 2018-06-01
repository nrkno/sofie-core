import { SegmentLineItemGeneric } from './SegmentLineItems'
import { TransformedCollection } from './typings'

export interface RunningOrderBaselineItem extends SegmentLineItemGeneric {
	segmentLineId: undefined
	trigger: {
		type: 0
		value: 0
	}
	disabled: false
	expectedDuration: 0
	transitions: undefined
	continuesRefId: undefined
	adLibSourceId: undefined
}

// @ts-ignore
export const RunningOrderBaselineItems: TransformedCollection<RunningOrderBaselineItem, RunningOrderBaselineItem>
	// @ts-ignore
	= new Mongo.Collection<RunningOrderBaselineItem>('segmentLineBaselineItems')
