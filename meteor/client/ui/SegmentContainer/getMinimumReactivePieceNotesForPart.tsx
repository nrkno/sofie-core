import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { UIShowStyleBase } from '../../../lib/api/showStyles'
import { UIStudio } from '../../../lib/api/studios'
import { Part } from '../../../lib/collections/Parts'
import { Piece, Pieces, PieceStatusCode } from '../../../lib/collections/Pieces'
import { checkPieceContentStatus, getNoteSeverityForPieceStatus } from '../../../lib/mediaObjects'
import { getIgnorePieceContentStatus } from '../../lib/localStorage'
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
			if (st.status !== PieceStatusCode.OK && st.status !== PieceStatusCode.UNKNOWN && !getIgnorePieceContentStatus()) {
				const severity = getNoteSeverityForPieceStatus(st.status) || NoteSeverity.WARNING
				if (severity === NoteSeverity.ERROR) {
					counts.criticial++
				} else if (severity === NoteSeverity.WARNING) {
					counts.warning++
				}
			}
		}
	}
	return counts
}
