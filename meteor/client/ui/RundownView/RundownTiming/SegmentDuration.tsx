import * as React from 'react'
import { PartId } from '../../../../lib/collections/Parts'
import { withTiming, WithTiming } from './withTiming'
import { unprotectString } from '../../../../lib/lib'
import { RundownUtils } from '../../../lib/rundown'

interface ISegmentDurationProps {
	partIds: PartId[]
}

/**
 * A presentational component that will render a counter that will show how much content
 * is left in a segment consisting of given parts
 * @class SegmentDuration
 * @extends React.Component<WithTiming<ISegmentDurationProps>>
 */
export const SegmentDuration = withTiming<ISegmentDurationProps, {}>()(
	class SegmentDuration extends React.Component<WithTiming<ISegmentDurationProps>> {
		render() {
			if (
				this.props.partIds &&
				this.props.timingDurations.partExpectedDurations &&
				this.props.timingDurations.partPlayed
			) {
				let partExpectedDurations = this.props.timingDurations.partExpectedDurations
				let partPlayed = this.props.timingDurations.partPlayed

				const duration = this.props.partIds.reduce((memo, partId) => {
					const pId = unprotectString(partId)
					return partExpectedDurations[pId] !== undefined
						? memo + partExpectedDurations[pId] - (partPlayed[pId] || 0)
						: memo
				}, 0)

				return (
					<span className={duration < 0 ? 'negative' : undefined}>
						{RundownUtils.formatDiffToTimecode(duration, false, false, true, false, true, '+')}
					</span>
				)
			}

			return null
		}
	}
)
