import { PartNote, SegmentNote, RundownNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { PieceStatusCode } from '../collections/Pieces'
import { PartId, PieceId, RundownId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'

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
	'getSegmentPartNotes' = 'rundownNotifications.getSegmentPartNotes',
	'getMediaObjectIssues' = 'rundownNotifications.getMediaObjectIssues',
}

export type RankedNote = (PartNote | SegmentNote | RundownNote) & {
	rank: number
}
/** How often the client polls for updates on media statuses */
export const MEDIASTATUS_POLL_INTERVAL = 10 * 1000

export interface RundownNotificationsAPI {
	getSegmentPartNotes(playlistId: RundownPlaylistId, rundownIds: RundownId[]): Promise<RankedNote[]>
	getMediaObjectIssues(rundownIds: RundownId[]): Promise<IMediaObjectIssue[]>
}
