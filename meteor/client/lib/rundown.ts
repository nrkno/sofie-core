import { Meteor } from 'meteor/meteor'
import { SegmentLineItemUi, SegmentLineUi } from '../ui/SegmentTimeline/SegmentTimelineContainer'
import * as _ from 'underscore'
import * as Timecode from 'smpte-timecode'
import { Settings } from '../../lib/Settings'

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

	export function formatTimeToTimecode (seconds: number): string {
		return (new Timecode(seconds * Settings['frameRate'], Settings['frameRate'], false)).toString()
	}
}
