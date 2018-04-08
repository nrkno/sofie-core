import { SegmentLineItemUi, SegmentLineUi } from '../ui/SegmentTimeline/SegmentTimelineContainer'
import * as _ from 'underscore'

export namespace RundownUtils {
	export function getSegmentLineDuration (segmentLineItems: Array<SegmentLineItemUi>): number {
		return (_.max(segmentLineItems.map((item) => {
			return item.duration || item.expectedDuration
		}))) || 0
	}

	export function getSegmentDuration (segmentLines: Array<SegmentLineUi>): number {
		return (_.max(segmentLines.map((item) => {
			return (item.items && this.getSegmentLineDuration(item.items)) || 0
		}))) || 0
	}
}
