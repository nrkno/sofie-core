import { IBlueprintAdLibPiece } from '@sofie-automation/blueprints-integration'
import { BucketAdLibId, BucketId, StudioId, ShowStyleVariantId } from './Ids'
import { RundownImportVersions } from './Rundown'

export interface BucketAdLib extends IBlueprintAdLibPiece {
	_id: BucketAdLibId
	bucketId: BucketId

	/**
	 * If an AdLib within the Bucket doesn't match the studioId/showStyleVariantId combination
	 * the adLib will be shown as disabled
	 */
	studioId: StudioId
	showStyleVariantId: ShowStyleVariantId
	importVersions: RundownImportVersions // TODO - is this good?
}