import { IBlueprintAdLibPiece } from '@sofie-automation/blueprints-integration'
import { BucketAdLibId, BucketId, StudioId, ShowStyleVariantId } from './Ids'
import { PieceTimelineObjectsBlob } from './Piece'
import { RundownImportVersions } from './Rundown'

export interface BucketAdLib extends Omit<IBlueprintAdLibPiece, 'timelineObjects'> {
	_id: BucketAdLibId
	bucketId: BucketId

	/**
	 * If an AdLib within the Bucket doesn't match the studioId/showStyleVariantId combination
	 * the adLib will be shown as disabled
	 */
	studioId: StudioId
	showStyleVariantId: ShowStyleVariantId
	importVersions: RundownImportVersions // TODO - is this good?

	/** Stringified timelineObjects */
	timelineObjectsString: PieceTimelineObjectsBlob
}
