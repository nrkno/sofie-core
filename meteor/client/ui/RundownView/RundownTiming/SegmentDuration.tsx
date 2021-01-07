import * as React from 'react'
import { withTiming, WithTiming } from './withTiming'
import { unprotectString } from '../../../../lib/lib'
import { RundownUtils } from '../../../lib/rundown'
import { PartUi } from '../../SegmentTimeline/SegmentTimelineContainer'

interface ISegmentDurationProps {
	parts: PartUi[]
}

/**
 * A presentational component that will render a counter that will show how much content
 * is left in a segment consisting of given parts
 * @class SegmentDuration
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
			budget += part.instance.part.expectedDuration || 0
			playedOut += partPlayed[unprotectString(part.instance.part._id)] || 0
		})

		const duration = budget - playedOut

		return (
			<span className={duration < 0 ? 'negative' : undefined}>
				{RundownUtils.formatDiffToTimecode(duration, false, false, true, false, true, '+')}
			</span>
		)
	}

	return null
})
