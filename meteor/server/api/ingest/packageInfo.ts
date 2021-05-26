import * as _ from 'underscore'
import { ExpectedPackageId } from '../../../lib/collections/ExpectedPackages'
import { MediaObject, MediaObjId } from '../../../lib/collections/MediaObjects'
import { PackageInfoDB } from '../../../lib/collections/PackageInfos'
import { PieceInstances } from '../../../lib/collections/PieceInstances'
import { Pieces } from '../../../lib/collections/Pieces'
import { Rundown, RundownId, Rundowns } from '../../../lib/collections/Rundowns'
import { SegmentId, Segments } from '../../../lib/collections/Segments'
import { lazyIgnore, unprotectString } from '../../../lib/lib'
import { logger } from '../../logging'
import { updateSegmentFromCache } from './rundownInput'
import { PartInstances } from '../../../lib/collections/PartInstances'

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

	const processedPackageId = unprotectString(packageId).split('_')[1] || unprotectString(packageId) // TODO: A temporary hack -- Jan Starzak, 2021-05-26

	/** All segments that need updating */
	const segmentsToUpdate = new Map<SegmentId, RundownId>()

	// Find Pieces that listen to these packageInfo updates:
	Pieces.find({
		listenToPackageInfoUpdates: { $elemMatch: { packageId: processedPackageId } },
	}).map((piece) => {
		segmentsToUpdate.set(piece.startSegmentId, piece.startRundownId)
	})

	// Find the PieceInstances affected by these packageInfo updates, and get all of their parent partInstance Ids
	const partInstanceIds = _.uniq(
		PieceInstances.find({
			// we only care about active PieceInstances
			reset: {
				$eq: false,
			},
			'piece.listenToPackageInfoUpdates': { $elemMatch: { packageId: processedPackageId } },
		}).map((pieceInstance) => pieceInstance.partInstanceId)
	)

	PartInstances.find({
		_id: {
			$in: partInstanceIds,
		},
	}).map((partInstance) => {
		segmentsToUpdate.set(partInstance.segmentId, partInstance.rundownId)
	})

	logger.debug(
		`"${packageId}" will trigger update of segments: ${Array(segmentsToUpdate.keys())
			.map((key) => `"${key}"`)
			.join(', ')}`
	)

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
