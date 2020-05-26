import { Tracker } from 'meteor/tracker'
import { getCurrentTime } from '../../lib/lib'

/** Invalidate a reactive computation after a given amount of time */
export function invalidateAfter (timeout: number): void {
	const time = new Tracker.Dependency()
	time.depend()
	setTimeout(() => {
		time.changed()
	}, timeout)
}

/** Invalidate a reactive computation after when a given time is reached */
export function invalidateAt (timestamp: number): void {
	const timeout = Math.max(0, timestamp - getCurrentTime())
	invalidateAfter(timeout)
}
