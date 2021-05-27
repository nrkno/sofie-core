import * as _ from 'underscore'
import { ExpectedPackageDBType, ExpectedPackageId, ExpectedPackages } from '../../../lib/collections/ExpectedPackages'
import { MediaObject, MediaObjId } from '../../../lib/collections/MediaObjects'
import { PackageInfoDB } from '../../../lib/collections/PackageInfos'
import { RundownId, Rundowns } from '../../../lib/collections/Rundowns'
import { SegmentId } from '../../../lib/collections/Segments'
import { assertNever, lazyIgnore, unprotectString } from '../../../lib/lib'
import { logger } from '../../logging'
import { CommitIngestData, runIngestOperationWithCache } from './lockFunction'
import { Meteor } from 'meteor/meteor'
import { updateSegmentFromIngestData } from './generation'

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
	logger.debug(`PackegeInfo updated "${packageId}"`)

	const pkg = ExpectedPackages.findOne(packageId)
	if (!pkg) {
		// TODO - error
		return
	}

	switch (pkg.fromPieceType) {
		case ExpectedPackageDBType.PIECE:
		case ExpectedPackageDBType.ADLIB_ACTION:
		case ExpectedPackageDBType.BASELINE_ADLIB_ACTION: {
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
			// Ignore, as we can't handle that for now
			break
		default:
			assertNever(pkg)
			break
	}
}

const pendingPackageUpdates = new Map<RundownId, Array<ExpectedPackageId>>()

function onUpdatedPackageInfoForRundown(rundownId: RundownId, packageIds: Array<ExpectedPackageId>) {
	const tmpRundown = Rundowns.findOne(rundownId)
	if (!tmpRundown) {
		// TODO - error
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
			/** All segments that need updating */
			const segmentsToUpdate = new Set<SegmentId>()

			for (const packageId of packageIds) {
				const pkg = cache.ExpectedPackages.findOne(packageId)
				if (pkg) {
					const piece = cache.Pieces.findOne(pkg.pieceId)
					if (piece) {
						const segmentId = piece.startSegmentId

						const listeningPieces = cache.Pieces.findFetch({
							startSegmentId: segmentId,
							listenToPackageInfoUpdates: { $elemMatch: { packageId: pkg.blueprintPackageId } },
						})
						if (listeningPieces.length > 0) {
							segmentsToUpdate.add(segmentId)
						}
					}
				}
			}

			logger.debug(
				`PackageInfo for "${packageIds.join(', ')}" will trigger update of segments: ${Array.from(
					segmentsToUpdate
				).join(', ')}`
			)

			const segmentChanges: Array<Promise<CommitIngestData | null>> = []

			for (const segmentId of segmentsToUpdate) {
				const segment = cache.Segments.findOne(segmentId)
				if (segment) {
					const ingestSegment = ingestRundown?.segments?.find((s) => s.externalId === segment.externalId)
					if (ingestSegment) {
						// TODO - do this batching better, this is a bit inefficient in some loading/processing
						segmentChanges.push(updateSegmentFromIngestData(cache, ingestSegment, false))
					} else {
						logger.error(`Ingest data for Segment "${segmentId}" not found`)
					}
				} else {
					logger.error(`Segment "${segmentId}" not found`)
				}
			}

			const segmentChanges2 = _.compact(await Promise.all(segmentChanges))

			const result = segmentChanges2.shift()
			if (result) {
				for (const res of segmentChanges2) {
					// Cheat and only update properties we know are set
					result.changedSegmentIds.push(...res.changedSegmentIds)
				}

				return result
			} else {
				return null
			}
		}
	)
}
