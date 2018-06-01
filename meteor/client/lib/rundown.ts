import { Meteor } from 'meteor/meteor'
import { SegmentLineItemUi, SegmentLineUi } from '../ui/SegmentTimeline/SegmentTimelineContainer'
import * as _ from 'underscore'
import * as Timecode from 'smpte-timecode'
import { Settings } from '../../lib/Settings'

export namespace RundownUtils {
	function padZero (input: number, places?: number): string {
		places = places || 2
		return input < Math.pow(10, places - 1) ? '0'.repeat(places - 1) + input.toString(10) : input.toString(10)
	}

	export function getSegmentDuration (lines: Array<SegmentLineUi>) {
		return lines.reduce((memo, item) => {
			return memo + (item.duration || item.expectedDuration || item.renderedDuration || 0)
		}, 0)
	}

	export function formatTimeToTimecode (milliseconds: number): string {
		let negativeSign = ''
		if (milliseconds < 0) {
			milliseconds = milliseconds * -1
			negativeSign = '-'
		}
		return negativeSign + ((new Timecode(milliseconds * Settings['frameRate'] / 1000, Settings['frameRate'], false)).toString())
	}

	export function formatTimeToShortTime (milliseconds: number): string {
		return formatDiffToTimecode(Math.max(milliseconds, 0), false)
	}

	export function formatDiffToTimecode (milliseconds: number, showPlus?: boolean): string {

		const isNegative = milliseconds < 0
		if (isNegative) {
			milliseconds = milliseconds * -1
		}

		const minutes = Math.floor(milliseconds / (60 * 1000))
		const secondsRest = Math.ceil(Math.floor(milliseconds % (60 * 1000)) / 1000)

		return (isNegative ? '-' : (showPlus && milliseconds > 0 ? '+' : '')) + padZero(minutes) + ':' + padZero(secondsRest)
	}

	export function isInsideViewport (scrollLeft: number, scrollWidth: number, segmentLine: SegmentLineUi, segmentLineStartsAt: number | undefined, segmentLineDuration: number | undefined, segmentLineItem?: SegmentLineItemUi) {
		if (scrollLeft + scrollWidth < (segmentLineStartsAt || segmentLine.startsAt || 0) + (segmentLineItem !== undefined ? (segmentLineItem.renderedInPoint || 0) : 0)) {
			return false
		} else if (scrollLeft > (segmentLineStartsAt || segmentLine.startsAt || 0) +
					(segmentLineItem !== undefined ?
						(segmentLineItem.renderedInPoint || 0) + (segmentLineItem.renderedDuration || (
							(segmentLine.duration !== undefined ?
								segmentLine.duration :
								(segmentLineDuration || 0) - (segmentLineItem.renderedInPoint || 0))
							)
						) :
						(segmentLine.duration !== undefined ?
							segmentLine.duration :
							(segmentLine.renderedDuration || 0)
						)
					)
				) {
			return false
		}
		return true
	}
}
