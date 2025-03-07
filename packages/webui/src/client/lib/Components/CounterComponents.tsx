import { RundownUtils } from '../rundown'

interface OverUnderProps {
	value: number
}

export const OverUnderClockComponent = (props: OverUnderProps): JSX.Element => {
	const overUnder = props.value > 0 ? 'Over' : 'Under'
	return (
		<div className="counter-component__over-under-clock">
			<span>{overUnder}</span>
			<span>
				{RundownUtils.formatDiffToTimecode(props.value, true, false, true, true, true, undefined, true, true)}
			</span>
		</div>
	)
}

export const PlannedEndComponent = (props: OverUnderProps): JSX.Element => {
	return (
		<span className="counter-component__planned-end">
			{RundownUtils.formatTimeToTimecode({ frameRate: 25 }, props.value, true)}
		</span>
	)
}

export const TimeToPlannedEndComponent = (props: OverUnderProps): JSX.Element => {
	return (
		<span className="counter-component__time-to-planned-end">
			{RundownUtils.formatTimeToTimecode({ frameRate: 25 }, props.value, true)}
		</span>
	)
}
