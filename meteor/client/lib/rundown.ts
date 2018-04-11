import { Meteor } from 'meteor/meteor'
import { SegmentLineItemUi, SegmentLineUi } from '../ui/SegmentTimeline/SegmentTimelineContainer'
import * as _ from 'underscore'
import * as Timecode from 'smpte-timecode'
import { Settings } from '../../lib/Settings'

export namespace RundownUtils {
	export function getSegmentDuration (lines: Array<SegmentLineUi>) {
		return lines.reduce((memo, item) => {
			return memo + (item.renderedDuration || 0)
		}, 0)
	}

	export function formatTimeToTimecode (seconds: number): string {
		return (new Timecode(seconds * Settings['frameRate'], Settings['frameRate'], false)).toString()
	}
}
