import classNames from 'classnames'
import React from 'react'
import { SegmentUi } from '../../SegmentTimeline/SegmentTimelineContainer'
import { RundownUtils } from '../../../lib/rundown'
import { useTranslation } from 'react-i18next'
import { useCurrentTime } from '../../../lib/lib'

interface ISegmentExpectedTimingProps {
	segment: SegmentUi
	className?: string
	labelClassName?: string
	isLiveSegment: boolean
}

/**
 * A presentational component that will render a counter that will show the wall time that a break starts at.
 * (Or ends at, if there's no start time but an end time is provided.)
 * @function SegmentExpectedTiming
 * @extends React.Component<ISegmentExpectedTimingProps>
 */
export const SegmentExpectedTiming = function SegmentExpectedTiming(
	props: ISegmentExpectedTimingProps
): JSX.Element | null {
	const { t } = useTranslation()
	const currentTime = useCurrentTime()
	const passedExpectedStart =
		props.segment.segmentTiming?.expectedStart && currentTime > props.segment.segmentTiming?.expectedStart
	let value = props.segment.segmentTiming?.expectedStart
	let usingEnd = false
	if (props.isLiveSegment || passedExpectedStart) {
		usingEnd = true
		value = props.segment.segmentTiming?.expectedEnd
	}

	if (value === null || value === undefined) {
		return null
	}

	const date = new Date(value)

	return (
		<>
			<span className={props.labelClassName}>{t(usingEnd ? 'Planned End' : 'Planned Start')}</span>
			<span className={classNames(props.className)} role="timer">
				{RundownUtils.padZeros(date.getHours(), 2)}:{RundownUtils.padZeros(date.getMinutes(), 2)}:
				{RundownUtils.padZeros(date.getSeconds(), 2)}
			</span>
		</>
	)
}
