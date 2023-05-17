import { TrackedNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { PartId, PieceId, RundownId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ProtectedString } from '../lib'
import { PieceContentStatusObj } from '../mediaObjects'

export type UISegmentPartNoteId = ProtectedString<'UISegmentPartNote'>
export interface UISegmentPartNote {
	_id: UISegmentPartNoteId
	playlistId: RundownPlaylistId
	rundownId: RundownId
	segmentId: SegmentId

	note: TrackedNote
}

export type UIPieceContentStatusId = ProtectedString<'UIPieceContentStatus'>
export interface UIPieceContentStatus {
	_id: UIPieceContentStatusId

	segmentRank: number
	partRank: number

	partId: PartId
	rundownId: RundownId
	segmentId: SegmentId
	pieceId: PieceId

	name: string
	segmentName: string

	status: PieceContentStatusObj
}
