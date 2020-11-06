import * as React from 'react'
import { getCurrentTimeReactive } from '../../lib/currentTimeReactive'
import { withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'

export const Clock = withTracker<{ className?: string | undefined }, {}, { now: number }>(() => {
	return {
		now: getCurrentTimeReactive(),
	}
})(
	class Clock extends React.Component<{ now: number; className?: string | undefined }> {
		render() {
			const now = new Date(this.props.now)
			return (
				<div className={this.props.className}>{`${now.toLocaleTimeString(undefined, {
					formatMatcher: 'best fit',
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit',
				})}`}</div>
			)
		}
	}
)
