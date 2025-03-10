import { RundownUtils } from '../rundown'

interface OverUnderProps {
	value: number
}

export const OverUnderClockComponent = (props: OverUnderProps): JSX.Element => {
	return (
		<div className="counter-component__over-under">
			<span className={props.value < 0 ? 'under' : 'over'}>
				{RundownUtils.formatTimeToTimecode({ frameRate: 25 }, props.value, true, false, true)}
			</span>
		</div>
	)
}

export const PlannedEndComponent = (props: OverUnderProps): JSX.Element => {
	return (
		<span className="counter-component__planned-end">
			{RundownUtils.formatTimeToTimecode({ frameRate: 25 }, props.value, false, false, true)}
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

export const TimesSincePlannedEndComponent = (props: OverUnderProps): JSX.Element => {
	return (
		<span className="counter-component__time-since-planned-end">
			{RundownUtils.formatTimeToTimecode({ frameRate: 25 }, props.value, true, false, true)}
		</span>
	)
}
