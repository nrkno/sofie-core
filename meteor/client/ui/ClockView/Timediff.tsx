import * as React from 'react'
import ClassNames from 'classnames'
import { RundownUtils } from '../../lib/rundown'

export const Timediff = class Timediff extends React.Component<{ time: number }> {
	render(): JSX.Element {
		const time = -this.props.time
		const isNegative = Math.floor(time / 1000) > 0
		const timeString = RundownUtils.formatDiffToTimecode(time, true, false, true, false, true, '', false, true)

		return (
			<span
				className={ClassNames({
					'clocks-segment-countdown-red': isNegative,
					'clocks-counter-heavy': time / 1000 > -30,
				})}
			>
				{timeString}
			</span>
		)
	}
}
