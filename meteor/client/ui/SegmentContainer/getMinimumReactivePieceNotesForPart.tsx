import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { PartNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { Part } from '../../../lib/collections/Parts'
import { Piece, Pieces, PieceStatusCode } from '../../../lib/collections/Pieces'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { Studio } from '../../../lib/collections/Studios'
import { normalizeArray } from '../../../lib/lib'
import { checkPieceContentStatus, getNoteSeverityForPieceStatus } from '../../../lib/mediaObjects'
import { getIgnorePieceContentStatus } from '../../lib/localStorage'

export function getMinimumReactivePieceNotesForPart(
	studio: Studio,
	showStyleBase: ShowStyleBase,
	part: Part
): PartNote[] {
	const notes: Array<PartNote> = []

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

	const sourceLayerMap = showStyleBase && normalizeArray(showStyleBase.sourceLayers, '_id')
	for (const piece of pieces) {
		// TODO: check statuses (like media availability) here

		if (sourceLayerMap && piece.sourceLayerId && sourceLayerMap[piece.sourceLayerId]) {
			const sourceLayer = sourceLayerMap[piece.sourceLayerId]
			const st = checkPieceContentStatus(piece, sourceLayer, studio)
			if (st.status !== PieceStatusCode.OK && st.status !== PieceStatusCode.UNKNOWN && !getIgnorePieceContentStatus()) {
				notes.push({
					type: getNoteSeverityForPieceStatus(st.status) || NoteSeverity.WARNING,
					origin: {
						name: 'Media Check',
						pieceId: piece._id,
					},
					message: {
						key: st.message || '',
					},
				})
			}
		}
	}
	return notes
}
