import * as React from 'react'
import ClassNames from 'classnames'
import { withTiming, WithTiming } from './withTiming'
import { RundownUtils } from '../../../lib/rundown'
import { PartId } from '../../../../lib/collections/Parts'
import { unprotectString } from '../../../../lib/lib'

interface IPartElapsedProps {
	currentPartId: PartId | undefined
	className?: string
}

/**
 * A presentational component that will render the elapsed duration of the current part
 * @class CurrentPartElapsed
 * @extends React.Component<WithTiming<{}>>
 */
export const CurrentPartElapsed = withTiming<IPartElapsedProps, {}>({
	isHighResolution: true,
})(
	class CurrentPartElapsed extends React.Component<WithTiming<IPartElapsedProps>> {
		render() {
			const displayTimecode =
				this.props.currentPartId && this.props.timingDurations.partPlayed
					? this.props.timingDurations.partPlayed[unprotectString(this.props.currentPartId)] || 0
					: 0

			return (
				<span className={ClassNames(this.props.className)} role="timer">
					{RundownUtils.formatDiffToTimecode(displayTimecode || 0, true, false, true, false, true, '', false, true)}
				</span>
			)
		}
	}
)
