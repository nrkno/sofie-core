import classNames from 'classnames'
import React, { ReactNode } from 'react'
import { SegmentUi } from '../../SegmentTimeline/SegmentTimelineContainer'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { RundownUtils } from '../../../lib/rundown'

interface IMilestoneWallTimeProps {
	segment: SegmentUi | DBSegment
	label?: ReactNode
	className?: string
}

/**
 * A presentational component that will render a counter that will show how much content
 * is left in a segment consisting of given parts
 * @function MilestoneWallTime
 * @extends React.Component<IMilestoneWallTimeProps>
 */
export const MilestoneWallTime = function MilestoneWallTime(props: IMilestoneWallTimeProps): JSX.Element | null {
	const value = props.segment.milestoneBackTime ?? props.segment.milestoneCumeTime

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
