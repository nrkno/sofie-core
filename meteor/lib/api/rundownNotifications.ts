import { RundownId } from '../collections/Rundowns'
import { PartNote } from './notes'
import { PieceId } from '../collections/Pieces'
import { RundownAPI } from './rundown'

export interface IMediaObjectIssue {
	pieceId: PieceId,
	name: string,
	status: RundownAPI.PieceStatusCode,
	message: string | null
}

export interface RundownNotificationsAPI {
	getSegmentPartNotes (rRundownIds: RundownId[]): Promise<(PartNote & {
		rank: number;
	})[]>
	getMediaObjectIssues (rundownId: RundownId): Promise<IMediaObjectIssue[]>
}
