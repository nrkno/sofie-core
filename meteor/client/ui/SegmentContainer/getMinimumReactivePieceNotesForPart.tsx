import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { UIShowStyleBase } from '../../../lib/api/showStyles'
import { UIStudio } from '../../../lib/api/studios'
import { Part } from '../../../lib/collections/Parts'
import { Piece, Pieces, PieceStatusCode } from '../../../lib/collections/Pieces'
import { getIgnorePieceContentStatus } from '../../lib/localStorage'
import { checkPieceContentStatus } from '../../lib/mediaObjects'
import { SegmentNoteCounts } from './withResolvedSegment'

export function getReactivePieceNoteCountsForPart(
	studio: UIStudio,
	showStyleBase: UIShowStyleBase,
	part: Part
): SegmentNoteCounts {
	const counts: SegmentNoteCounts = {
		criticial: 0,
		warning: 0,
	}

	const pieces = Pieces.find(
		{
			startRundownId: part.rundownId,
			startPartId: part._id,
		},
		{
			fields: {
				_id: 1,
				name: 1,
				sourceLayerId: 1,
				content: 1,
				expectedPackages: 1,
			},
		}
	).fetch() as Array<Pick<Piece, '_id' | 'name' | 'sourceLayerId' | 'content' | 'expectedPackages'>>

	const sourceLayerMap = showStyleBase && showStyleBase.sourceLayers
	for (const piece of pieces) {
		// TODO: check statuses (like media availability) here

		if (sourceLayerMap && piece.sourceLayerId && sourceLayerMap[piece.sourceLayerId]) {
			const sourceLayer = sourceLayerMap[piece.sourceLayerId]
			const st = checkPieceContentStatus(piece, sourceLayer, studio)
			if (!getIgnorePieceContentStatus()) {
				switch (st.status) {
					case PieceStatusCode.OK:
					case PieceStatusCode.UNKNOWN:
						// Ignore
						break
					case PieceStatusCode.SOURCE_NOT_SET:
						counts.criticial++
						break
					case PieceStatusCode.SOURCE_HAS_ISSUES:
					case PieceStatusCode.SOURCE_BROKEN:
					case PieceStatusCode.SOURCE_MISSING:
						counts.warning++
						break
					default:
						assertNever(st.status)
						break
				}
			}
		}
	}
	return counts
}
