import classNames from 'classnames'
import React, { ReactNode } from 'react'
import { SegmentUi } from '../../SegmentTimeline/SegmentTimelineContainer'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { RundownUtils } from '../../../lib/rundown'

interface IBreakWallTimeProps {
	segment: SegmentUi | DBSegment
	label?: ReactNode
	className?: string
}

/**
 * A presentational component that will render a counter that will show the wall time that a break starts at.
 * (Or ends at, if there's no start time but an end time is provided.)
 * @function BreakWallTime
 * @extends React.Component<IBreakWallTimeProps>
 */
export const BreakWallTime = function BreakWallTime(props: IBreakWallTimeProps): JSX.Element | null {
	const value = props.segment.breakStartTime ?? props.segment.breakEndTime

	if (value === null || value === undefined) {
		return null
	}

	const date = new Date(value)

	return (
		<>
			{props.label}
			<span className={classNames(props.className)} role="timer">
				{RundownUtils.padZeros(date.getHours(), 2)}:{RundownUtils.padZeros(date.getMinutes(), 2)}:
				{RundownUtils.padZeros(date.getSeconds(), 2)}
			</span>
		</>
	)
}
