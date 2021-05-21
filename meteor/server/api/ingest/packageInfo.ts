import { ListenToPackageUpdate } from '@sofie-automation/blueprints-integration'
import { ExpectedPackageId } from '../../../lib/collections/ExpectedPackages'
import { MediaObject, MediaObjId } from '../../../lib/collections/MediaObjects'
import { PackageInfoDB, PackageInfoId } from '../../../lib/collections/PackageInfos'
import { Piece, Pieces } from '../../../lib/collections/Pieces'
import { Rundown, RundownId, Rundowns } from '../../../lib/collections/Rundowns'
import { SegmentId, Segments } from '../../../lib/collections/Segments'
import { lazyIgnore, unprotectString } from '../../../lib/lib'
import { logger } from '../../logging'
import { updateSegmentFromCache } from './rundownInput'

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
	// Find Pieces that listen to these packageInfo updates:
	const pieces = Pieces.find({
		listenToPackageInfoUpdates: { $elemMatch: { packageId: unprotectString(packageId) } },
	}).fetch()
	// TODO: also check for pieceInstances?

	/** All segments that need updating */
	const segmentsToUpdate = new Map<SegmentId, RundownId>()

	for (const piece of pieces) {
		segmentsToUpdate.set(piece.startSegmentId, piece.startRundownId)
	}

	const rundowns = new Map<RundownId, Rundown | undefined>()

	segmentsToUpdate.forEach((rundownId: RundownId, segmentId: SegmentId) => {
		lazyIgnore(
			`onUpdatedPackageInfo_${segmentId}`,
			() => {
				const segment = Segments.findOne(segmentId)

				if (!rundowns.has(rundownId)) {
					rundowns.set(rundownId, Rundowns.findOne(rundownId))
				}
				const rundown = rundowns.get(rundownId)
				if (rundown) {
					if (segment) {
						updateSegmentFromCache(rundown.externalId, rundown.studioId, segment)
					} else {
						logger.error(`Segment "${rundownId}" not found`)
					}
				} else {
					logger.error(`Rundown "${rundownId}" not found`)
				}
			},
			1000
		)
	})
}
