import { PeripheralDevices, RundownPlaylists } from './collections'
import { PeripheralDeviceType } from '../lib/collections/PeripheralDevices'
import { getCurrentTime, stringifyError } from '../lib/lib'
import { logger } from './logging'
import { Meteor } from 'meteor/meteor'
import { TSR } from '@sofie-automation/blueprints-integration'
import { DEFAULT_TSR_ACTION_TIMEOUT_TIME } from '@sofie-automation/shared-lib/dist/core/constants'
import { QueueStudioJob } from './worker/worker'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { fetchStudioIds } from './optimizations'
import { internalStoreRundownPlaylistSnapshot } from './api/snapshot'
import { deferAsync } from '@sofie-automation/corelib/dist/lib'
import { getCoreSystemAsync } from './coreSystem/collection'
import { cleanupOldDataInner } from './api/cleanup'
import { CollectionCleanupResult } from '../lib/api/system'
import { ICoreSystem } from '../lib/collections/CoreSystem'
import { executePeripheralDeviceFunctionWithCustomTimeout } from './api/peripheralDevice/executeFunction'

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

export async function nightlyCronjobInner(): Promise<void> {
	const previousLastNightlyCronjob = lastNightlyCronjob
	lastNightlyCronjob = getCurrentTime()
	logger.info('Nightly cronjob: starting...')
	const system = await getCoreSystemAsync()

	await Promise.allSettled([
		cleanupOldDataCronjob().catch((error) => {
			logger.error(`Cronjob: Error when cleaning up old data: ${error}`)
			logger.error(error)
		}),
		restartCasparCG(system, previousLastNightlyCronjob).catch((e) => {
			logger.error(`Cron: Restart CasparCG error: ${e}`)
		}),
		storeSnapshots(system).catch((e) => {
			logger.error(`Cron: Rundown Snapshots error: ${e}`)
		}),
	])

	// last:
	logger.info('Nightly cronjob: done')
}

async function cleanupOldDataCronjob() {
	const cleanupResults = await cleanupOldDataInner(true)
	if (typeof cleanupResults === 'string') {
		logger.warn(`Cronjob: Could not clean up old data due to: ${cleanupResults}`)
	} else {
		for (const result of Object.values<CollectionCleanupResult[0]>(cleanupResults)) {
			if (result.docsToRemove > 0) {
				logger.info(`Cronjob: Removed ${result.docsToRemove} documents from "${result.collectionName}"`)
			}
		}
	}
}

async function restartCasparCG(system: ICoreSystem | undefined, previousLastNightlyCronjob: number) {
	const ps: Array<Promise<any>> = []
	// Restart casparcg
	if (system?.cron?.casparCGRestart?.enabled) {
		const peripheralDevices = await PeripheralDevices.findFetchAsync({
			type: PeripheralDeviceType.PLAYOUT,
		})

		for (const device of peripheralDevices) {
			const subDevices = await PeripheralDevices.findFetchAsync({
				parentDeviceId: device._id,
			})

			for (const subDevice of subDevices) {
				if (subDevice.type === PeripheralDeviceType.PLAYOUT && subDevice.subType === TSR.DeviceType.CASPARCG) {
					logger.info('Cronjob: Trying to restart CasparCG on device "' + subDevice._id + '"')

					ps.push(
						executePeripheralDeviceFunctionWithCustomTimeout(
							subDevice._id,
							DEFAULT_TSR_ACTION_TIMEOUT_TIME,
							{
								actionId: TSR.CasparCGActions.RestartServer,
								payload: {},
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
			}
		}
	}

	await Promise.all(ps)
	failedRetries = 0
}

async function storeSnapshots(system: ICoreSystem | undefined) {
	if (system?.cron?.storeRundownSnapshots?.enabled) {
		const filter = system.cron.storeRundownSnapshots.rundownNames?.length
			? { name: { $in: system.cron.storeRundownSnapshots.rundownNames } }
			: {}

		const playlists = await RundownPlaylists.findFetchAsync(filter)
		for (const playlist of playlists) {
			lowPrioFcn(() => {
				logger.info(`Cronjob: Will store snapshot for rundown playlist "${playlist._id}"`)
				internalStoreRundownPlaylistSnapshot(playlist, 'Automatic, taken by cron job').catch((err) => {
					logger.error(err)
				})
			})
		}
	}
}

Meteor.startup(() => {
	function nightlyCronjob() {
		const timeSinceLast = getCurrentTime() - lastNightlyCronjob
		if (
			isLowSeason() &&
			timeSinceLast > 20 * 3600 * 1000 // was last run yesterday
		) {
			nightlyCronjobInner().catch((e) => {
				logger.error(`Nightly cronjob: error: ${e}`)
			})
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
