import { RundownBaselineObjId, RundownId } from './Ids'
import { PieceTimelineObjectsBlob } from './Piece'

export interface RundownBaselineObj {
	_id: RundownBaselineObjId
	/** The rundown this timeline-object belongs to */
	rundownId: RundownId

	/** Stringified timelineObjects */
	timelineObjectsString: PieceTimelineObjectsBlob
}
