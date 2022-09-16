import ClassNames from 'classnames'
import React, { ReactNode } from 'react'
import { withTiming, WithTiming } from './withTiming'
import { unprotectString } from '../../../../lib/lib'
import { RundownUtils } from '../../../lib/rundown'
import { PartUi } from '../../SegmentTimeline/SegmentTimelineContainer'
import { SegmentId } from '../../../../lib/collections/Segments'
import { calculatePartInstanceExpectedDurationWithPreroll } from '@sofie-automation/corelib/dist/playout/timings'

interface ISegmentDurationProps {
	segmentId: SegmentId
	parts: PartUi[]
	label?: ReactNode
	className?: string
	/** If set, the timer will display just the played out duration */
	countUp?: boolean
	/** Always show planned segment duration instead of counting up/down */
	fixed?: boolean
}

/**
 * A presentational component that will render a counter that will show how much content
 * is left in a segment consisting of given parts
 * @function SegmentDuration
 * @extends React.Component<WithTiming<ISegmentDurationProps>>
 */
export const SegmentDuration = withTiming<ISegmentDurationProps, {}>()(function SegmentDuration(
	props: WithTiming<ISegmentDurationProps>
) {
	let duration: number | undefined = undefined
	let budget = 0
	let playedOut = 0

	const segmentBudgetDuration =
		props.timingDurations.segmentBudgetDurations &&
		props.timingDurations.segmentBudgetDurations[unprotectString(props.segmentId)]

	if (segmentBudgetDuration !== undefined) {
		budget = segmentBudgetDuration
	}
	if (props.parts && props.timingDurations.partPlayed) {
		const { partPlayed } = props.timingDurations
		if (segmentBudgetDuration === undefined) {
			props.parts.forEach((part) => {
				budget +=
					part.instance.orphaned || part.instance.part.untimed
						? 0
						: calculatePartInstanceExpectedDurationWithPreroll(part.instance) || 0
			})
		}
		props.parts.forEach((part) => {
			playedOut += (!part.instance.part.untimed ? partPlayed[unprotectString(part.instance.part._id)] : 0) || 0
		})
	}

	duration = budget - playedOut

	if (duration !== undefined) {
		return (
			<>
				{props.label}
				{props.fixed ? (
					<span className={ClassNames(props.className)} role="timer">
						{RundownUtils.formatDiffToTimecode(budget, false, false, true, false, true, '+')}
					</span>
				) : props.countUp ? (
					<span className={ClassNames(props.className)} role="timer">
						{RundownUtils.formatDiffToTimecode(playedOut, false, false, true, false, true, '+')}
					</span>
				) : (
					<span className={ClassNames(props.className, duration < 0 ? 'negative' : undefined)} role="timer">
						{RundownUtils.formatDiffToTimecode(duration, false, false, true, false, true, '+')}
					</span>
				)}
			</>
		)
	}

	return null
})
