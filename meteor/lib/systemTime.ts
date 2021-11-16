import { Meteor } from 'meteor/meteor'
import { logger } from './logging'
import { systemTime } from './lib'
import { MeteorCall } from './api/methods'

if (Meteor.isServer) {
	// Handled in server/api/systemTime/systemTime.ts
} else {
	/** How often the client should sync its time to the server [ms] */
	const SYNC_TIME = 5 * 60 * 1000 // 5 minutes

	/** How good time sync quality we should strive for [ms] */
	const TARGET_TIME_SYNC_QUALITY = 50 // 50 milliseconds

	/** How much we assume a clock to drift over time [time unit per time unit] */
	const ASSUMED_CLOCK_DRIFT = 5 / (3600 * 24) // We assume 5 seconds drift in a day for the system clock

	// fetch time from server:
	const updateDiffTime = () => {
		// Calculate an "adjusted standard deviation", something that increases over time.
		// Using this we can decide wether a new measurement is better or worse than previous one.
		const currentSyncQuality = systemTime.stdDev + (Date.now() - systemTime.lastSync) * ASSUMED_CLOCK_DRIFT

		// If the sync quality is better than the target, there's no need to re-sync it
		if (currentSyncQuality > TARGET_TIME_SYNC_QUALITY) {
			const sentTime = Date.now()
			MeteorCall.peripheralDevice
				.getTimeDiff()
				.then((stat) => {
					const replyTime = Date.now()

					const diff = (sentTime + replyTime) / 2 - stat.currentTime
					const stdDev = Math.abs(sentTime - replyTime) / 2 // Not really a standard deviation calculation, but it's what we can do with just one measuring point..

					// Only use the result if the stdDev is better than previous sync quality:
					if (stdDev <= currentSyncQuality) {
						// Only trace the result if the diff is different than the previous:
						if (Math.abs(systemTime.diff - diff) > 10) {
							logger.verbose(
								`Time diff set to: ${diff} ms (server stdDev: ${
									Math.floor(stat.stdDev * 10) / 10
								} ms, client stdDev: ${stdDev} ms)`
							)
						}

						// Store the result into the global variable `systemTime` (used in getCurrentTime()):
						systemTime.diff = diff
						systemTime.stdDev = stdDev
						systemTime.lastSync = Date.now()
						systemTime.hasBeenSet = true
					}
				})
				.catch((err) => {
					logger.error(err)
				})
		}
	}

	Meteor.startup(() => {
		// Run it once right away:
		updateDiffTime()

		// Also run it a few seconds in, to get a more accurate reading:
		Meteor.setTimeout(() => {
			updateDiffTime()
		}, 5000)

		// Also run it after 30 seconds, to get an even more accurate reading:
		Meteor.setTimeout(() => {
			updateDiffTime()
		}, 30 * 1000)

		// Then run it on an interval, to ensure it is kept up to date:
		Meteor.setInterval(() => {
			if (Meteor.status().connected) {
				updateDiffTime()
			}
		}, SYNC_TIME)
	})
}
