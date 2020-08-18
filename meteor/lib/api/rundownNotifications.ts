import { PartId } from '../collections/Parts'
import { PieceId } from '../collections/Pieces'
import { RundownId } from '../collections/Rundowns'
import { SegmentId } from '../collections/Segments'
import { PartNote, RundownNote, SegmentNote } from './notes'
import { RundownAPI } from './rundown'

export interface IMediaObjectIssue {
	segmentRank: number
	partRank: number
	partId: PartId
	rundownId: RundownId
	segmentId: SegmentId
	pieceId: PieceId
	name: string
	segmentName: string
	status: RundownAPI.PieceStatusCode
	message: string | null
}

export enum RundownNotificationsAPIMethods {
	'getSegmentPartNotes' = 'rundownNotifications.getSegmentPartNotes',
	'getMediaObjectIssues' = 'rundownNotifications.getMediaObjectIssues',
}

export type RankedNote = (PartNote | SegmentNote | RundownNote) & {
	rank: number
}

export interface RundownNotificationsAPI {
	getSegmentPartNotes(rundownIds: RundownId[]): Promise<RankedNote[]>
	getMediaObjectIssues(rundownIds: RundownId[]): Promise<IMediaObjectIssue[]>
}
