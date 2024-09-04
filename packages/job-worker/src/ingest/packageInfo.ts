import { ExpectedPackageDBType } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	ExpectedPackagesRegenerateProps,
	PackageInfosUpdatedRundownProps,
} from '@sofie-automation/corelib/dist/worker/ingest'
import { logger } from '../logging'
import { JobContext } from '../jobs'
import { regenerateSegmentsFromIngestData } from './generationSegment'
import { UpdateIngestRundownAction, runIngestJob, runWithRundownLock } from './lock'
import { loadIngestModelFromRundown } from './model/implementation/LoadIngestModel'
import { assertNever } from '@sofie-automation/corelib/dist/lib'

/**
 * Debug: Regenerate ExpectedPackages for a Rundown
 */
export async function handleExpectedPackagesRegenerate(
	context: JobContext,
	data: ExpectedPackagesRegenerateProps
): Promise<void> {
	await runWithRundownLock(context, data.rundownId, async (rundown, rundownLock) => {
		if (!rundown) throw new Error(`Rundown "${data.rundownId}" not found`)

		const ingestModel = await loadIngestModelFromRundown(context, rundownLock, rundown)

		// nocommit - reimplement?

		// for (const part of ingestModel.getAllOrderedParts()) {
		// 	updateExpectedMediaAndPlayoutItemsForPartModel(context, part)
		// }

		// await updateExpectedPackagesForRundownBaseline(context, ingestModel, undefined, true)

		await ingestModel.saveAllToDatabase()
	})
}

/**
 * Some PackageInfos have been updated, regenerate any Parts which depend on these PackageInfos
 */
export async function handleUpdatedPackageInfoForRundown(
	context: JobContext,
	data: PackageInfosUpdatedRundownProps
): Promise<void> {
	if (data.packageIds.length === 0) {
		return
	}

	await runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (!ingestRundown) {
				logger.error(
					`onUpdatedPackageInfoForRundown called but ingestRundown is undefined (rundownExternalId: "${data.rundownExternalId}")`
				)
				return UpdateIngestRundownAction.REJECT
			}
			return ingestRundown // don't mutate any ingest data
		},
		async (context, ingestModel, ingestRundown) => {
			if (!ingestRundown) throw new Error('onUpdatedPackageInfoForRundown called but ingestRundown is undefined')

			/** All segments that need updating */
			const segmentsToUpdate = new Set<SegmentId>()
			let regenerateRundownBaseline = false

			for (const packageId of data.packageIds) {
				const pkgIngestSources = ingestModel.findExpectedPackageIngestSources(packageId)
				for (const source of pkgIngestSources) {
					switch (source.fromPieceType) {
						case ExpectedPackageDBType.PIECE:
						case ExpectedPackageDBType.ADLIB_PIECE:
						case ExpectedPackageDBType.ADLIB_ACTION:
							segmentsToUpdate.add(source.segmentId)
							break

						case ExpectedPackageDBType.BASELINE_ADLIB_ACTION:
						case ExpectedPackageDBType.BASELINE_ADLIB_PIECE:
						case ExpectedPackageDBType.RUNDOWN_BASELINE_OBJECTS:
							regenerateRundownBaseline = true
							break
						default:
							assertNever(source)
					}
				}
				if (pkgIngestSources.length === 0) {
					logger.warn(`onUpdatedPackageInfoForRundown: Missing ingestSources for package: "${packageId}"`)
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
				ingestModel,
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
