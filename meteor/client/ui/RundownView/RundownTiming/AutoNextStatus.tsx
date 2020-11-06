import * as React from 'react'
import { withTiming, WithTiming } from './withTiming'

export const AutoNextStatus = withTiming<{}, {}>({
	filter: 'currentPartWillAutoNext',
	isHighResolution: true,
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
