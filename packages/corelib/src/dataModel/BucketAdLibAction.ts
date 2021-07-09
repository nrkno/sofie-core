import { BucketAdLibActionId, BucketId, StudioId, ShowStyleVariantId } from './Ids'
import { RundownImportVersions } from './Rundown'
import { AdLibActionCommon } from './AdlibAction'

export interface BucketAdLibAction extends Omit<AdLibActionCommon, 'rundownId'> {
	_id: BucketAdLibActionId
	bucketId: BucketId

	externalId: string

	/**
	 * If an AdLib within the Bucket doesn't match the studioId/showStyleVariantId combination
	 * the adLib will be shown as disabled
	 */
	studioId: StudioId
	showStyleVariantId: ShowStyleVariantId
	importVersions: RundownImportVersions // TODO - is this good?

	/** The following extended interface allows assigning namespace information to the actions as they are stored in the
	 *  database after being emitted from the blueprints
	 */
}
