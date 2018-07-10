import { SegmentLineItemUi, SegmentLineUi } from '../ui/SegmentTimeline/SegmentTimelineContainer'
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

	export function formatTimeToTimecode (milliseconds: number, showPlus?: boolean, enDashAsMinus?: boolean): string {
		let sign = ''
		if (milliseconds < 0) {
			milliseconds = milliseconds * -1
			sign = (enDashAsMinus ? '\u2013' : '-')
		} else {
			if (showPlus) sign = '+'
		}
		return sign + ((new Timecode(milliseconds * Settings['frameRate'] / 1000, Settings['frameRate'], false)).toString())
	}

	export function formatTimeToShortTime (milliseconds: number): string {
		return formatDiffToTimecode(Math.max(milliseconds, 0), false)
	}

	export function formatDiffToTimecode (milliseconds: number, showPlus?: boolean, showHours?: boolean, enDashAsMinus?: boolean): string {

		const isNegative = milliseconds < 0
		if (isNegative) {
			milliseconds = milliseconds * -1
		}

		let hours = 0

		let minutes = Math.floor(milliseconds / (60 * 1000))
		if (showHours) {
			hours = Math.floor(minutes / 60)
			minutes = minutes % 60
		}
		const secondsRest = Math.ceil(Math.floor(milliseconds % (60 * 1000)) / 1000)

		return (isNegative ? (enDashAsMinus ? '\u2013' : '-') : (showPlus && milliseconds > 0 ? '+' : '')) + (showHours ? padZero(hours) + ':' : '') + padZero(minutes) + ':' + padZero(secondsRest)
	}

	export function isInsideViewport (scrollLeft: number, scrollWidth: number, segmentLine: SegmentLineUi, segmentLineStartsAt: number | undefined, segmentLineDuration: number | undefined, segmentLineItem?: SegmentLineItemUi) {
		if (segmentLineItem && segmentLineItem._id === 'LGBm6Flqj7oJHkuT8mK_99Vp3AA_') {
			console.log(segmentLine.duration, segmentLineDuration, segmentLine.renderedDuration, segmentLine.expectedDuration, segmentLineItem.duration, segmentLineItem.expectedDuration, segmentLineItem.renderedDuration, segmentLineItem.infiniteMode)
		}
		if (scrollLeft + scrollWidth < (segmentLineStartsAt || segmentLine.startsAt || 0) + (segmentLineItem !== undefined ? (segmentLineItem.renderedInPoint || 0) : 0)) {
			return false
		} else if (scrollLeft > (segmentLineStartsAt || segmentLine.startsAt || 0) +
					(segmentLineItem !== undefined ?
						(segmentLineItem.renderedInPoint || 0) + (segmentLineItem.expectedDuration || (
							(segmentLine.duration !== undefined ?
								segmentLine.duration :
								(segmentLineDuration || segmentLine.renderedDuration || segmentLine.expectedDuration || 0) - (segmentLineItem.renderedInPoint || 0))
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
