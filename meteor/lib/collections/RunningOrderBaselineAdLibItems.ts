import { SegmentLineItemGeneric } from './SegmentLineItems'
import { TransformedCollection } from '../typings/meteor'

export interface RunningOrderBaselineAdLibItem extends SegmentLineItemGeneric {
	trigger: undefined
	disabled: false
}

// @ts-ignore
export const RunningOrderBaselineAdLibItems: TransformedCollection<RunningOrderBaselineAdLibItem, RunningOrderBaselineAdLibItem>
	// @ts-ignore
	= new Mongo.Collection<RunningOrderBaselineAdLibItem>('runningOrderBaselineAdLibItems')
