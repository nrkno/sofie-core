import * as React from 'react'
import ClassNames from 'classnames'
import { RundownUtils } from '../../lib/rundown'

export const Timediff = class Timediff extends React.Component<{ time: number }> {
	render() {
		const time = -this.props.time
		const isNegative = Math.floor(time / 1000) > 0
		const timeString = RundownUtils.formatDiffToTimecode(time, true, false, true, false, true, '', false, true) // @todo: something happened here with negative time
		// RundownUtils.formatDiffToTimecode(this.props.displayTimecode || 0, true, false, true, false, true, '', false, true)
		// const timeStringSegments = timeString.split(':')
		// const fontWeight = (no) => no === '00' || no === '+00'
		return (
			<span
				className={ClassNames({
					'clocks-segment-countdown-red': isNegative,
					'clocks-counter-heavy': time / 1000 > -30,
				})}>
				{timeString}
			</span>
		)
	}
}
