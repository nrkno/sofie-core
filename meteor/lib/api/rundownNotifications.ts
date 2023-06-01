import { TrackedNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import {
	AdLibActionId,
	BucketAdLibActionId,
	BucketAdLibId,
	BucketId,
	PartId,
	PieceId,
	PieceInstanceId,
	RundownBaselineAdLibActionId,
	RundownId,
	RundownPlaylistId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ProtectedString } from '../lib'
import { PieceContentStatusObj } from '../mediaObjects'
import { ITranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'

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

	rundownId: RundownId
	partId?: PartId
	segmentId?: SegmentId

	pieceId: PieceId | AdLibActionId | RundownBaselineAdLibActionId | PieceInstanceId

	name: string | ITranslatableMessage
	segmentName: string

	status: PieceContentStatusObj
}

export type UIBucketContentStatusId = ProtectedString<'UIBucketContentStatus'>
export interface UIBucketContentStatus {
	_id: UIBucketContentStatusId

	bucketId: BucketId
	docId: BucketAdLibActionId | BucketAdLibId

	name: string | ITranslatableMessage

	status: PieceContentStatusObj
}
