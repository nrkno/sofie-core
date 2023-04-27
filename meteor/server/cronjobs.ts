import { PeripheralDevices, RundownPlaylists } from './collections'
import { PeripheralDeviceAPI } from '../lib/api/peripheralDevice'
import { PeripheralDeviceType } from '../lib/collections/PeripheralDevices'
import { getCurrentTime, stringifyError, waitForPromise, waitForPromiseAll } from '../lib/lib'
import { logger } from './logging'
import { Meteor } from 'meteor/meteor'
import { TSR } from '@sofie-automation/blueprints-integration'
import { DEFAULT_TSR_ACTION_TIMEOUT_TIME } from '@sofie-automation/shared-lib/dist/core/constants'
import { QueueStudioJob } from './worker/worker'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { fetchStudioIds } from './optimizations'
import { internalStoreRundownPlaylistSnapshot } from './api/snapshot'
import { deferAsync } from '@sofie-automation/corelib/dist/lib'
import { getCoreSystem } from './coreSystem/collection'
import { cleanupOldDataInner } from './api/cleanup'
import { CollectionCleanupResult } from '../lib/api/system'

const lowPrioFcn = (fcn: () => any) => {
	// Do it at a random time in the future:
	Meteor.setTimeout(() => {
		fcn()
	}, Math.random() * 10 * 1000)
}
/** Returns true if it is "low-season" (like during the night) when it is suitable to run cronjobs */
function isLowSeason() {
	const d = new Date(getCurrentTime())
	return (
		d.getHours() >= 4 && d.getHours() < 5 // It is nighttime
	)
}

let lastNightlyCronjob = 0
let failedRetries = 0

export function nightlyCronjobInner(): void {
	const previousLastNightlyCronjob = lastNightlyCronjob
	lastNightlyCronjob = getCurrentTime()
	logger.info('Nightly cronjob: starting...')
	const system = getCoreSystem()

	// Clean up old data:
	try {
		const cleanupResults = waitForPromise(cleanupOldDataInner(true))
		if (typeof cleanupResults === 'string') {
			logger.warn(`Cronjob: Could not clean up old data due to: ${cleanupResults}`)
		} else {
			for (const result of Object.values<CollectionCleanupResult[0]>(cleanupResults)) {
				if (result.docsToRemove > 0) {
					logger.info(`Cronjob: Removed ${result.docsToRemove} documents from "${result.collectionName}"`)
				}
			}
		}
	} catch (error) {
		logger.error(`Cronjob: Error when cleaning up old data: ${error}`)
		logger.error(error)
	}

	const ps: Array<Promise<any>> = []
	// Restart casparcg
	if (system?.cron?.casparCGRestart?.enabled) {
		PeripheralDevices.find({
			type: PeripheralDeviceType.PLAYOUT,
		}).forEach((device) => {
			PeripheralDevices.find({
				parentDeviceId: device._id,
			}).forEach((subDevice) => {
				if (subDevice.type === PeripheralDeviceType.PLAYOUT && subDevice.subType === TSR.DeviceType.CASPARCG) {
					logger.info('Cronjob: Trying to restart CasparCG on device "' + subDevice._id + '"')

					ps.push(
						PeripheralDeviceAPI.executeFunctionWithCustomTimeout(
							subDevice._id,
							DEFAULT_TSR_ACTION_TIMEOUT_TIME,
							{
								actionId: TSR.CasparCGActions.RestartServer,
							}
						)
							.then(() => {
								logger.info('Cronjob: "' + subDevice._id + '": CasparCG restart done')
							})
							.catch((err) => {
								logger.error(
									`Cronjob: "${subDevice._id}": CasparCG restart error: ${stringifyError(err)}`
								)

								if ((err + '').match(/timeout/i)) {
									// If it was a timeout, maybe we could try again later?
									if (failedRetries < 5) {
										failedRetries++
										lastNightlyCronjob = previousLastNightlyCronjob // try again later
									}
								} else {
									// Propogate the error
									throw err
								}
							})
					)
				}
			})
		})
	}
	try {
		waitForPromiseAll(ps)
		failedRetries = 0
	} catch (err) {
		logger.error(err)
	}

	if (system?.cron?.storeRundownSnapshots?.enabled) {
		const filter = system.cron.storeRundownSnapshots.rundownNames?.length
			? { name: { $in: system.cron.storeRundownSnapshots.rundownNames } }
			: {}

		RundownPlaylists.find(filter).forEach((playlist) => {
			lowPrioFcn(() => {
				logger.info(`Cronjob: Will store snapshot for rundown playlist "${playlist._id}"`)
				ps.push(internalStoreRundownPlaylistSnapshot(playlist, 'Automatic, taken by cron job'))
			})
		})
	}
	Promise.all(ps)
		.then(() => {
			failedRetries = 0
		})
		.catch((err) => {
			logger.error(err)
		})

	// last:
	logger.info('Nightly cronjob: done')
}

Meteor.startup(() => {
	function nightlyCronjob() {
		const timeSinceLast = getCurrentTime() - lastNightlyCronjob
		if (
			isLowSeason() &&
			timeSinceLast > 20 * 3600 * 1000 // was last run yesterday
		) {
			nightlyCronjobInner()
		}
	}

	Meteor.setInterval(nightlyCronjob, 5 * 60 * 1000) // check every 5 minutes
	nightlyCronjob()

	function anyTimeCronjob(force?: boolean) {
		{
			// Clean up playlists:
			if (isLowSeason() || force) {
				deferAsync(
					async () => {
						// Ensure there are no empty playlists on an interval
						const studioIds = await fetchStudioIds({})
						await Promise.all(
							studioIds.map(async (studioId) => {
								const job = await QueueStudioJob(StudioJobs.CleanupEmptyPlaylists, studioId, undefined)
								await job.complete
							})
						)
					},
					(e) => {
						logger.error(`Cron: CleanupPlaylists error: ${e}`)
					}
				)
			}
		}
	}
	Meteor.setInterval(anyTimeCronjob, 30 * 60 * 1000) // every 30 minutes
	anyTimeCronjob(true)
})
