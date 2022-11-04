import { TrackedNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { PieceStatusCode } from '../collections/Pieces'
import { PartId, PieceId, RundownId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ProtectedString } from '../lib'

export interface IMediaObjectIssue {
	segmentRank: number
	partRank: number
	partId: PartId
	rundownId: RundownId
	segmentId: SegmentId
	pieceId: PieceId
	name: string
	segmentName: string
	status: PieceStatusCode
	message: string | null
}

export enum RundownNotificationsAPIMethods {
	'getMediaObjectIssues' = 'rundownNotifications.getMediaObjectIssues',
}

export type UISegmentPartNoteId = ProtectedString<'UISegmentPartNote'>
export interface UISegmentPartNote {
	_id: UISegmentPartNoteId
	playlistId: RundownPlaylistId
	rundownId: RundownId
	segmentId: SegmentId

	note: TrackedNote
}

/** How often the client polls for updates on media statuses */
export const MEDIASTATUS_POLL_INTERVAL = 10 * 1000

export type UIMediaObjectIssueId = ProtectedString<'UIMediaObjectIssue'>
export interface UIMediaObjectIssue {
	_id: UIMediaObjectIssueId

	segmentRank: number
	partRank: number

	partId: PartId
	rundownId: RundownId
	segmentId: SegmentId
	pieceId: PieceId

	name: string
	segmentName: string
	status: PieceStatusCode
	message: string | null
}

export interface RundownNotificationsAPI {
	getMediaObjectIssues(rundownIds: RundownId[]): Promise<IMediaObjectIssue[]>
}
