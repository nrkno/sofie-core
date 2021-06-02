import { ExpectedPackageDBType, ExpectedPackageId, ExpectedPackages } from '../../../lib/collections/ExpectedPackages'
import { MediaObject, MediaObjId } from '../../../lib/collections/MediaObjects'
import { PackageInfoDB } from '../../../lib/collections/PackageInfos'
import { RundownId, Rundowns } from '../../../lib/collections/Rundowns'
import { SegmentId } from '../../../lib/collections/Segments'
import { assertNever, lazyIgnore } from '../../../lib/lib'
import { logger } from '../../logging'
import { runIngestOperationWithCache } from './lockFunction'
import { Meteor } from 'meteor/meteor'
import { regenerateSegmentsFromIngestData } from './generation'

/** to-be @deprecated hack for backwards-compatibility*/
export function onUpdatedMediaObject(_id: MediaObjId, _newDocument: MediaObject | null) {
	// TODO: Implement, for backwards-compatibility
	// oldDocument?: MediaObject
	// if (
	// 	!oldDocument ||
	// 	(newDocument.mediainfo?.format?.duration &&
	// 		oldDocument.mediainfo?.format?.duration !== newDocument.mediainfo?.format?.duration)
	// ) {
	// 	const segmentsToUpdate = new Map<SegmentId, RundownId>()
	// 	const rundownIdsInStudio = Rundowns.find({ studioId: newDocument.studioId }, { fields: { _id: 1 } })
	// 		.fetch()
	// 		.map((rundown) => rundown._id)
	// 	Parts.find({
	// 		rundownId: { $in: rundownIdsInStudio },
	// 		'hackListenToMediaObjectUpdates.mediaId': newDocument.mediaId,
	// 	}).forEach((part) => {
	// 		segmentsToUpdate.set(part.segmentId, part.rundownId)
	// 	})
	// 	segmentsToUpdate.forEach((rundownId, segmentId) => {
	// 		lazyIgnore(
	// 			`updateSegmentFromMediaObject_${segmentId}`,
	// 			() => updateSegmentFromCache(rundownId, segmentId),
	// 			200
	// 		)
	// 	})
	// }
}

export function onUpdatedPackageInfo(packageId: ExpectedPackageId, doc: PackageInfoDB | null) {
	logger.info(`PackageInfo updated "${packageId}"`)

	const pkg = ExpectedPackages.findOne(packageId)
	if (!pkg) {
		logger.error(`onUpdatedPackageInfo: Received update for missing package: "${packageId}"`)
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

				lazyIgnore(
					`onUpdatedPackageInfoForRundown${pkg.rundownId}`,
					() => {
						const packageIds = pendingPackageUpdates.get(pkg.rundownId)
						if (packageIds) {
							pendingPackageUpdates.delete(pkg.rundownId)
							onUpdatedPackageInfoForRundown(pkg.rundownId, packageIds)
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

function onUpdatedPackageInfoForRundown(rundownId: RundownId, packageIds: Array<ExpectedPackageId>) {
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

	// TODO - can we avoid loading the cache for package info we know doesnt affect anything?

	// TODO - what if type was BASELINE_ADLIB_ACTION?

	return runIngestOperationWithCache(
		'onUpdatedPackageInfoForRundown',
		tmpRundown.studioId,
		tmpRundown.externalId,
		(ingestRundown) => {
			if (!ingestRundown)
				throw new Meteor.Error('onUpdatedPackageInfoForRundown called but ingestData is undefined')
			return ingestRundown // don't mutate any ingest data
		},
		async (cache, ingestRundown) => {
			if (!ingestRundown)
				throw new Meteor.Error('onUpdatedPackageInfoForRundown called but ingestData is undefined')

			/** All segments that need updating */
			const segmentsToUpdate = new Set<SegmentId>()

			for (const packageId of packageIds) {
				const pkg = cache.ExpectedPackages.findOne(packageId)
				if (pkg) {
					if (pkg.fromPieceType === ExpectedPackageDBType.PIECE) {
						const piece = cache.Pieces.findOne(pkg.pieceId)
						if (piece) {
							const segmentId = piece.startSegmentId

							const listeningPieces = cache.Pieces.findOne((p) => p.startSegmentId === segmentId)
							if (listeningPieces) {
								segmentsToUpdate.add(segmentId)
							}
						} else {
							logger.warn(
								`onUpdatedPackageInfoForRundown: Missing raw piece: "${pkg.pieceId}" for package "${packageId}"`
							)
						}
					}
				} else {
					logger.warn(`onUpdatedPackageInfoForRundown: Missing package: "${packageId}"`)
				}
			}

			logger.info(
				`onUpdatedPackageInfoForRundown: PackageInfo for "${packageIds.join(
					', '
				)}" will trigger update of segments: ${Array.from(segmentsToUpdate).join(', ')}`
			)

			const { result, skippedSegments } = await regenerateSegmentsFromIngestData(
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
