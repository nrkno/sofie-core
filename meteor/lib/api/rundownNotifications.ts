import { TrackedNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import {
	BucketAdLibActionId,
	BucketAdLibId,
	BucketId,
	PartId,
	PieceId,
	RundownId,
	RundownPlaylistId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
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

// export enum UIPieceContentStatusSource {
// 	Piece = 'piece',
// 	BucketAdlib = 'bucket-adlib',
// 	BucketAction = 'bucket-action',
// }

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

export type UIBucketContentStatusId = ProtectedString<'UIBucketContentStatus'>
export interface UIBucketContentStatus {
	_id: UIBucketContentStatusId

	bucketId: BucketId
	docId: BucketAdLibActionId | BucketAdLibId

	name: string

	status: PieceContentStatusObj
}
