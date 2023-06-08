import type { Time } from '../common'
import type { IBlueprintPieceDB } from './piece'

export interface IBlueprintPieceInstance<TMetadata = unknown> {
	_id: string
	/** The part instace this piece belongs to */
	partInstanceId: string

	/** If this piece has been created play-time using an AdLibPiece, this should be set to it's source piece */
	adLibSourceId?: string
	/** If this piece has been insterted during run of rundown (such as adLibs), then this is set to the timestamp it was inserted */
	dynamicallyInserted?: Time

	piece: IBlueprintPieceDB<TMetadata>

	/** The time the system started playback of this part, undefined if not yet played back (milliseconds since epoch) */
	reportedStartedPlayback?: Time
	/** Whether the piece has stopped playback (the most recent time it was played), undefined if not yet played back or is currently playing.
	 * This is set from a callback from the playout gateway (milliseconds since epoch)
	 */
	reportedStoppedPlayback?: Time

	infinite?: {
		infinitePieceId: string
		/** When the instance was a copy made from hold */
		fromHold?: boolean

		/** Whether this was 'copied' from the previous PartInstance or Part */
		fromPreviousPart: boolean
		/** Whether this was 'copied' from the previous PartInstance via the playhead, rather than from a Part */
		fromPreviousPlayhead?: boolean
	}
}
export interface IBlueprintResolvedPieceInstance<TMetadata = unknown> extends IBlueprintPieceInstance<TMetadata> {
	resolvedStart: number
	resolvedDuration?: number
}
