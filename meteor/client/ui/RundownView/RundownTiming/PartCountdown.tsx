import * as React from 'react'
import { PartId } from '../../../../lib/collections/Parts'
import { withTiming, WithTiming } from './withTiming'
import { unprotectString } from '../../../../lib/lib'
import { RundownUtils } from '../../../lib/rundown'

interface IPartCountdownProps {
	partId?: PartId
	hideOnZero?: boolean
}

/**
 * A presentational component that will render a countdown to a given Part
 * @class PartCountdown
 * @extends React.Component<WithTiming<IPartCountdownProps>>
 */
export const PartCountdown = withTiming<IPartCountdownProps, {}>()(
	class PartCountdown extends React.Component<WithTiming<IPartCountdownProps>> {
		render() {
			return (
				<span>
					{this.props.partId &&
						this.props.timingDurations &&
						this.props.timingDurations.partCountdown &&
						this.props.timingDurations.partCountdown[unprotectString(this.props.partId)] !== undefined &&
						(this.props.hideOnZero !== true ||
							this.props.timingDurations.partCountdown[unprotectString(this.props.partId)] > 0) &&
						RundownUtils.formatTimeToShortTime(
							this.props.timingDurations.partCountdown[unprotectString(this.props.partId)]
						)}
				</span>
			)
		}
	}
)
