import { PieceUi, PartUi } from '../ui/SegmentTimeline/SegmentTimelineContainer'
import { Timecode } from 'timecode'
import { Settings } from '../../lib/Settings'
import { SourceLayerType } from 'tv-automation-sofie-blueprints-integration'

export namespace RundownUtils {
	function padZerundown (input: number, places?: number): string {
		places = places || 2
		return input < Math.pow(10, places - 1) ? '0'.repeat(places - 1) + input.toString(10) : input.toString(10)
	}

	export function getSegmentDuration (parts: Array<PartUi>) {
		return parts.reduce((memo, part) => {
			return memo + (part.duration || part.expectedDuration || part.renderedDuration || 0)
		}, 0)
	}

	export function formatTimeToTimecode (milliseconds: number, showPlus?: boolean, enDashAsMinus?: boolean, hideFrames?: boolean): string {
		let sign = ''
		if (milliseconds < 0) {
			milliseconds = milliseconds * -1
			sign = (enDashAsMinus ? '\u2013' : '-')
		} else {
			if (showPlus) sign = '+'
		}
		const tc = Timecode.init({ framerate: Settings['frameRate'], timecode: milliseconds * Settings['frameRate'] / 1000, drop_frame: !Number.isInteger(Settings['frameRate']) })
		const timeCodeString: String = tc.toString()
		return sign + (hideFrames ? timeCodeString.substr(0, timeCodeString.length - 3) : timeCodeString)
	}

	export function formatTimeToShortTime (milliseconds: number): string {
		return formatDiffToTimecode(Math.max(milliseconds, 0), false)
	}

	export function formatDiffToTimecode (milliseconds: number, showPlus?: boolean, showHours?: boolean, enDashAsMinus?: boolean, useSmartFloor?: boolean, useSmartHours?: boolean, minusPrefix?: string, floorTime?: boolean, hardFloor?: boolean): string {

		let isNegative = milliseconds < 0
		if (isNegative) {
			milliseconds = milliseconds * -1
		}

		let hours = 0

		let minutes = Math.floor(milliseconds / (60 * 1000))
		hours = Math.floor(minutes / 60)
		if (showHours || (useSmartHours && hours > 0)) {
			minutes = minutes % 60
		}
		let secondsRest
		if (!hardFloor) {
			if (floorTime) {
				secondsRest = useSmartFloor ?
					(milliseconds < 100 ? 0 : Math.floor(Math.floor(milliseconds % (60 * 1000)) / 1000))
					: Math.floor(Math.floor(milliseconds % (60 * 1000)) / 1000)
			} else {
				secondsRest = useSmartFloor ?
					(milliseconds < 100 ? 0 : Math.ceil(Math.floor(milliseconds % (60 * 1000)) / 1000))
					: Math.ceil(Math.floor(milliseconds % (60 * 1000)) / 1000)

				// cascade the overflowing second
				let overflow = secondsRest % 60
				if (overflow !== secondsRest) {
					secondsRest = overflow
					overflow = ++minutes % 60
					if (overflow !== minutes) {
						minutes = overflow
						hours++
					}
				}
			}
		} else {
			if (!isNegative) {
				secondsRest = useSmartFloor ?
					(milliseconds < 100 ? 0 : Math.floor(Math.floor(milliseconds % (60 * 1000)) / 1000))
					: Math.floor(Math.floor(milliseconds % (60 * 1000)) / 1000)
			} else {
				secondsRest = useSmartFloor ?
					(milliseconds < 100 ? 0 : Math.ceil(Math.floor(milliseconds % (60 * 1000)) / 1000))
					: Math.ceil(Math.floor(milliseconds % (60 * 1000)) / 1000)

				// cascade the overflowing second
				let overflow = secondsRest % 60
				if (overflow !== secondsRest) {
					secondsRest = overflow
					overflow = ++minutes % 60
					if (overflow !== minutes) {
						minutes = overflow
						hours++
					}
				}
			}

			// a hack for very close to 0 to be negative
			if (hours === 0 && minutes === 0 && secondsRest === 0) {
				isNegative = true
			}
		}

		return (isNegative ? (minusPrefix !== undefined ? minusPrefix : (enDashAsMinus ? '\u2013' : '-')) : (showPlus && milliseconds > 0 ? '+' : '')) + ((showHours || (useSmartHours && hours > 0)) ? padZerundown(hours) + ':' : '') + padZerundown(minutes) + ':' + padZerundown(secondsRest)
	}

	export function isInsideViewport (
		scrollLeft: number,
		scrollWidth: number,
		part: PartUi,
		partStartsAt: number | undefined,
		partDuration: number | undefined,
		piece?: PieceUi
	) {
		if (scrollLeft + scrollWidth <
			(partStartsAt || part.startsAt || 0) +
			(piece !== undefined ? (piece.renderedInPoint || 0) : 0)) {
			return false
		} else if (scrollLeft > (partStartsAt || part.startsAt || 0) +
					(piece !== undefined ?
						(piece.renderedInPoint || 0) + (piece.renderedDuration || (
							(part.duration !== undefined ?
								(part.duration + (part.getLastPlayOffset() || 0)) :
								(partDuration || part.renderedDuration || part.expectedDuration || 0)
									- (piece.renderedInPoint || 0))
							)
						) :
						(part.duration !== undefined ?
							(part.duration + (part.getLastPlayOffset() || 0)) :
							(partDuration || part.renderedDuration || 0)
						)
					)
				) {
			return false
		}
		return true
	}

	export function getSourceLayerClassName (partType: SourceLayerType): string {
		// CAMERA_MOVEMENT -> "camera-movement"
		return (
			((SourceLayerType[partType] || 'unknown-sourceLayer-' + partType) + '')
			.toLowerCase()
			.replace(/_/g,'-')
		)
	}
}
