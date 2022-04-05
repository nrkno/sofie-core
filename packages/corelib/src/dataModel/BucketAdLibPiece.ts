import { IBlueprintAdLibPiece, SomeContent } from '@sofie-automation/blueprints-integration'
import { BucketAdLibId, BucketId, StudioId, ShowStyleVariantId, ShowStyleBaseId } from './Ids'
import { PieceTimelineObjectsBlob } from './Piece'
import { RundownImportVersions } from './Rundown'

export interface BucketAdLib extends Omit<IBlueprintAdLibPiece, 'content'> {
	_id: BucketAdLibId
	bucketId: BucketId

	content: SomeContent

	/**
	 * If an AdLib within the Bucket doesn't match the studioId/showStyleVariantId combination
	 * the adLib will be shown as disabled
	 */
	studioId: StudioId
	/** Which ShowStyleBase the adlib action is valid for */
	showStyleBaseId: ShowStyleBaseId
	/** if showStyleVariantId is null, the adlibAction can be used with any variant */
	showStyleVariantId: ShowStyleVariantId | null

	importVersions: RundownImportVersions // TODO - is this good?

	/** Stringified timelineObjects */
	timelineObjectsString: PieceTimelineObjectsBlob
}
