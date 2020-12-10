import * as React from 'react'
import { getCurrentTimeReactive } from '../../lib/currentTimeReactive'
import { withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import Moment from 'react-moment'

export const Clock = withTracker<{ className?: string | undefined }, {}, { now: number }>(() => {
	return {
		now: getCurrentTimeReactive(),
	}
})(function Clock({ now, className }: { now: number; className?: string | undefined }) {
	return (
		<div className={className}>
			<Moment interval={0} format="HH:mm:ss" date={now} />
		</div>
	)
})
