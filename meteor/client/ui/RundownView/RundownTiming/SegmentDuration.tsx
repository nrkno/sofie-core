import React, { ReactNode } from 'react'
import { withTiming, WithTiming } from './withTiming'
import { unprotectString } from '../../../../lib/lib'
import { RundownUtils } from '../../../lib/rundown'
import { PartUi } from '../../SegmentTimeline/SegmentTimelineContainer'

interface ISegmentDurationProps {
	parts: PartUi[]
	label?: ReactNode
	/** If set, the timer will display just the played out duration */
	countUp?: boolean
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
	if (props.parts && props.timingDurations.partPlayed) {
		const { partPlayed } = props.timingDurations

		let budget = 0
		let playedOut = 0
		props.parts.forEach((part) => {
			budget += part.instance.orphaned || part.instance.part.untimed ? 0 : part.instance.part.expectedDuration || 0
			playedOut += (!part.instance.part.untimed ? partPlayed[unprotectString(part.instance.part._id)] : 0) || 0
		})

		const duration = budget - playedOut

		return props.countUp ? (
			<>
				{props.label}
				<span>{RundownUtils.formatDiffToTimecode(playedOut, false, false, true, false, true, '+')}</span>
			</>
		) : (
			<>
				{props.label}
				<span className={duration < 0 ? 'negative' : undefined}>
					{RundownUtils.formatDiffToTimecode(duration, false, false, true, false, true, '+')}
				</span>
			</>
		)
	}

	return null
})
