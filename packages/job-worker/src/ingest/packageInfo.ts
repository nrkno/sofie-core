import { ExpectedPackageDBType } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ExpectedPackagesRegenerateProps, PackageInfosUpdatedProps } from '@sofie-automation/corelib/dist/worker/ingest'
import { logger } from '../logging'
import { JobContext } from '../jobs'
import { regenerateSegmentsFromIngestData } from './generationSegment'
import { runIngestJob, runWithRundownLock } from './lock'
import { CacheForIngest } from './cache'
import { updateExpectedPackagesOnRundown } from './expectedPackages'

/**
 * Debug: Regenerate ExpectedPackages for a Rundown
 */
export async function handleExpectedPackagesRegenerate(
	context: JobContext,
	data: ExpectedPackagesRegenerateProps
): Promise<void> {
	await runWithRundownLock(context, data.rundownId, async (rundown, rundownLock) => {
		if (!rundown) throw new Error(`Rundown "${data.rundownId}" not found`)

		const cache = await CacheForIngest.createFromRundown(context, rundownLock, rundown)

		await updateExpectedPackagesOnRundown(context, cache)

		await cache.saveAllToDatabase()
	})
}

/**
 * Some PackageInfos have been updated, regenerate any Parts which depend on these PackageInfos
 */
export async function handleUpdatedPackageInfoForRundown(
	context: JobContext,
	data: PackageInfosUpdatedProps
): Promise<void> {
	if (data.packageIds.length === 0) {
		return
	}

	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (!ingestRundown) throw new Error('onUpdatedPackageInfoForRundown called but ingestData is undefined')
			return ingestRundown // don't mutate any ingest data
		},
		async (context, cache, ingestRundown) => {
			if (!ingestRundown) throw new Error('onUpdatedPackageInfoForRundown called but ingestData is undefined')

			/** All segments that need updating */
			const segmentsToUpdate = new Set<SegmentId>()
			let regenerateRundownBaseline = false

			for (const packageId of data.packageIds) {
				const pkg = cache.ExpectedPackages.findOne(packageId)
				if (pkg) {
					if (
						pkg.fromPieceType === ExpectedPackageDBType.PIECE ||
						pkg.fromPieceType === ExpectedPackageDBType.ADLIB_PIECE
					) {
						segmentsToUpdate.add(pkg.segmentId)
					} else if (
						pkg.fromPieceType === ExpectedPackageDBType.BASELINE_ADLIB_ACTION ||
						pkg.fromPieceType === ExpectedPackageDBType.BASELINE_ADLIB_PIECE ||
						pkg.fromPieceType === ExpectedPackageDBType.RUNDOWN_BASELINE_OBJECTS
					) {
						regenerateRundownBaseline = true
					}
				} else {
					logger.warn(`onUpdatedPackageInfoForRundown: Missing package: "${packageId}"`)
				}
			}

			logger.info(
				`onUpdatedPackageInfoForRundown: PackageInfo for "${data.packageIds.join(
					', '
				)}" will trigger update of segments: ${Array.from(segmentsToUpdate).join(', ')}`
			)

			if (regenerateRundownBaseline) {
				// trigger a re-generation of the rundown baseline
				// TODO - to be implemented.
			}

			const { result, skippedSegments } = await regenerateSegmentsFromIngestData(
				context,
				cache,
				ingestRundown,
				Array.from(segmentsToUpdate)
			)

			if (skippedSegments.length > 0) {
				logger.warn(
					`onUpdatedPackageInfoForRundown: Some segments were skipped during update: ${skippedSegments.join(
						', '
					)}`
				)
			}

			logger.warn(`onUpdatedPackageInfoForRundown: Changed ${result?.changedSegmentIds.length ?? 0} segments`)
			return result
		}
	)
}
