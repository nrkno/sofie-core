import React, { ReactNode } from 'react'
import { PartId } from '../../../../lib/collections/Parts'
import { withTiming, WithTiming } from './withTiming'
import { unprotectString } from '../../../../lib/lib'
import { RundownUtils } from '../../../lib/rundown'

interface IPartCountdownProps {
	partId?: PartId
	hideOnZero?: boolean
	label?: ReactNode
}

/**
 * A presentational component that will render a countdown to a given Part
 * @function PartCountdown
 * @extends React.Component<WithTiming<IPartCountdownProps>>
 */
export const PartCountdown = withTiming<IPartCountdownProps, {}>()(function PartCountdown(
	props: WithTiming<IPartCountdownProps>
) {
	if (!props.partId || !props.timingDurations?.partCountdown) return null
	const thisPartCountdown = props.timingDurations.partCountdown[unprotectString(props.partId)] as number | undefined

	const shouldShow = thisPartCountdown !== undefined && (props.hideOnZero !== true || thisPartCountdown > 0)

	return shouldShow ? (
		<>
			{props.label}
			<span>
				{RundownUtils.formatTimeToShortTime(
					thisPartCountdown!
				) /* shouldShow will be false if thisPartCountdown is undefined */}
			</span>
		</>
	) : null
})
