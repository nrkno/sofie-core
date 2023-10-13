import { PeripheralDevices, RundownPlaylists } from './collections'
import {
	PERIPHERAL_SUBTYPE_PROCESS,
	PeripheralDevice,
	PeripheralDeviceType,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { getCurrentTime } from '../lib/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { logger } from './logging'
import { Meteor } from 'meteor/meteor'
import { TSR } from '@sofie-automation/blueprints-integration'
import { DEFAULT_TSR_ACTION_TIMEOUT_TIME } from '@sofie-automation/shared-lib/dist/core/constants'
import { QueueStudioJob } from './worker/worker'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { fetchStudioIds } from './optimizations'
import { internalStoreRundownPlaylistSnapshot } from './api/snapshot'
import { deferAsync, normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { getCoreSystemAsync } from './coreSystem/collection'
import { cleanupOldDataInner } from './api/cleanup'
import { CollectionCleanupResult } from '../lib/api/system'
import { ICoreSystem } from '../lib/collections/CoreSystem'
import { executePeripheralDeviceFunctionWithCustomTimeout } from './api/peripheralDevice/executeFunction'
import {
	interpollateTranslation,
	isTranslatableMessage,
	translateMessage,
} from '@sofie-automation/corelib/dist/TranslatableMessage'

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

const CASPARCG_LAST_SEEN_PERIOD_MS = 3 * 60 * 1000 // Note: this must be higher than the ping interval used by playout-gateway

async function restartCasparCG(system: ICoreSystem | undefined, previousLastNightlyCronjob: number) {
	if (!system?.cron?.casparCGRestart?.enabled) return

	let shouldRetryAttempt = false
	const ps: Array<Promise<any>> = []

	const casparcgAndParentDevices = (await PeripheralDevices.findFetchAsync(
		{
			type: PeripheralDeviceType.PLAYOUT,
			subType: { $in: [PERIPHERAL_SUBTYPE_PROCESS, TSR.DeviceType.CASPARCG] },
		},
		{
			projection: {
				_id: 1,
				subType: 1,
				parentDeviceId: 1,
				lastSeen: 1,
			},
		}
	)) as Array<Pick<PeripheralDevice, '_id' | 'subType' | 'parentDeviceId' | 'lastSeen'>>

	const deviceMap = normalizeArrayToMap(casparcgAndParentDevices, '_id')

	for (const device of casparcgAndParentDevices) {
		if (device.subType !== TSR.DeviceType.CASPARCG) continue

		if (device.lastSeen < getCurrentTime() - CASPARCG_LAST_SEEN_PERIOD_MS) {
			logger.info(`Cronjob: Skipping CasparCG device "${device._id}" offline`)
			shouldRetryAttempt = true
			continue
		}

		if (!device.parentDeviceId) {
			logger.info(`Cronjob: Skipping CasparCG device "${device._id}" without parentDeviceId`)
			// Misconfiguration, don't retry
			continue
		}
		const parentDevice = deviceMap.get(device.parentDeviceId)
		if (!parentDevice) {
			logger.info(`Cronjob: Skipping CasparCG device "${device._id}" with a missing parent device`)
			// Misconfiguration, don't retry
			continue
		}

		if (parentDevice.lastSeen < getCurrentTime() - CASPARCG_LAST_SEEN_PERIOD_MS) {
			logger.info(`Cronjob: Skipping CasparCG device "${device._id}" with offline parent device`)
			shouldRetryAttempt = true
			continue
		}

		logger.info(`Cronjob: Trying to restart CasparCG on device "${device._id}"`)

		ps.push(
			executePeripheralDeviceFunctionWithCustomTimeout(device._id, DEFAULT_TSR_ACTION_TIMEOUT_TIME, {
				actionId: TSR.CasparCGActions.RestartServer,
				payload: {},
			})
				.then((res) => {
					if (res.result === TSR.ActionExecutionResultCode.Ok) {
						logger.info(`Cronjob: "${device._id}": CasparCG restart done`)
					} else {
						const errorMessage =
							res.response && isTranslatableMessage(res.response)
								? translateMessage(res.response, interpollateTranslation)
								: stringifyError(res.response)

						logger.warn(`Cronjob: "${device._id}": CasparCG restart error: ${errorMessage}`)

						// If it was a timeout, maybe try again later
						shouldRetryAttempt = true
					}
				})
				.catch((err) => {
					if ((err + '').match(/timeout/i)) {
						logger.warn(`Cronjob: "${device._id}": CasparCG restart timeout (Attempt ${failedRetries + 1})`)

						// If it was a timeout, maybe we could try again later?
						shouldRetryAttempt = true
					} else {
						logger.warn(`Cronjob: "${device._id}": CasparCG restart error: ${stringifyError(err)}`)
					}
				})
		)
	}

	await Promise.allSettled(ps)

	if (shouldRetryAttempt && failedRetries < 5) {
		failedRetries++
		lastNightlyCronjob = previousLastNightlyCronjob // try again later
	} else {
		failedRetries = 0
	}
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
	Meteor.setInterval(anyTimeCronjob, 30 * 60 * 1000) // every 30 minutes
	anyTimeCronjob(true)
})
