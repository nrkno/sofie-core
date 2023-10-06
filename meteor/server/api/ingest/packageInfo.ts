import { ExpectedPackageDBType } from '../../../lib/collections/ExpectedPackages'
import { PackageInfoDB } from '../../../lib/collections/PackageInfos'
import { ExpectedPackages, Rundowns } from '../../collections'
import { assertNever, lazyIgnore } from '../../../lib/lib'
import { logger } from '../../logging'
import { runIngestOperation } from './lib'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import { ExpectedPackageId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export function onUpdatedPackageInfo(packageId: ExpectedPackageId, _doc: PackageInfoDB | null): void {
	logger.info(`PackageInfo updated "${packageId}"`)

	const pkg = ExpectedPackages.findOne(packageId)
	if (!pkg) {
		logger.warn(`onUpdatedPackageInfo: Received update for missing package: "${packageId}"`)
		return
	}

	if (pkg.listenToPackageInfoUpdates) {
		switch (pkg.fromPieceType) {
			case ExpectedPackageDBType.PIECE:
			case ExpectedPackageDBType.ADLIB_PIECE:
			case ExpectedPackageDBType.ADLIB_ACTION:
			case ExpectedPackageDBType.BASELINE_ADLIB_PIECE:
			case ExpectedPackageDBType.BASELINE_ADLIB_ACTION:
			case ExpectedPackageDBType.RUNDOWN_BASELINE_OBJECTS: {
				const existingEntry = pendingPackageUpdates.get(pkg.rundownId)
				if (existingEntry) {
					// already queued, add to the batch
					existingEntry.push(pkg._id)
				} else {
					pendingPackageUpdates.set(pkg.rundownId, [pkg._id])
				}

				// TODO: Scaling - this won't batch correctly if package manager directs calls to multiple instances
				lazyIgnore(
					`onUpdatedPackageInfoForRundown_${pkg.rundownId}`,
					() => {
						const packageIds = pendingPackageUpdates.get(pkg.rundownId)
						if (packageIds) {
							pendingPackageUpdates.delete(pkg.rundownId)
							onUpdatedPackageInfoForRundown(pkg.rundownId, packageIds).catch((e) => {
								logger.error(`Updating ExpectedPackages for Rundown "${pkg.rundownId}" failed: ${e}`)
							})
						}
					},
					1000
				)
				break
			}
			case ExpectedPackageDBType.BUCKET_ADLIB:
			case ExpectedPackageDBType.BUCKET_ADLIB_ACTION:
			case ExpectedPackageDBType.STUDIO_BASELINE_OBJECTS:
				// Ignore, as we can't handle that for now
				break
			default:
				assertNever(pkg)
				break
		}
	}
}

const pendingPackageUpdates = new Map<RundownId, Array<ExpectedPackageId>>()

async function onUpdatedPackageInfoForRundown(
	rundownId: RundownId,
	packageIds: Array<ExpectedPackageId>
): Promise<void> {
	if (packageIds.length === 0) {
		return
	}

	const tmpRundown = Rundowns.findOne(rundownId)
	if (!tmpRundown) {
		logger.error(
			`onUpdatedPackageInfoForRundown: Missing rundown "${rundownId}" for packages "${packageIds.join(', ')}"`
		)
		return
	}

	await runIngestOperation(tmpRundown.studioId, IngestJobs.PackageInfosUpdated, {
		rundownExternalId: tmpRundown.externalId,
		peripheralDeviceId: null,
		packageIds,
	})
}
