import * as React from 'react'
import { TimingDataResolution, TimingTickResolution, withTiming, WithTiming } from './withTiming'

export const AutoNextStatus = withTiming<{}, {}>({
	filter: 'currentPartWillAutoNext',
	dataResolution: TimingDataResolution.High,
	tickResolution: TimingTickResolution.High,
})(
	class AutoNextStatus extends React.Component<WithTiming<{}>> {
		render() {
			return this.props.timingDurations.currentPartWillAutoNext ? (
				<div className="rundown-view__part__icon rundown-view__part__icon--auto-next"></div>
			) : (
				<div className="rundown-view__part__icon rundown-view__part__icon--next"></div>
			)
		}
	}
)
