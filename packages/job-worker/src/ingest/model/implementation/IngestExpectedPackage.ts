import { ExpectedPackage } from '@sofie-automation/blueprints-integration'
import {
	ExpectedPackageIngestSourcePart,
	ExpectedPackageIngestSourceRundownBaseline,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPackageId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Time } from 'superfly-timeline'
import { ReadonlyDeep } from 'type-fest'

export interface IngestExpectedPackage {
	_id: ExpectedPackageId

	/** Hash that changes whenever the content or version changes. See getContentVersionHash() */
	contentVersionHash: string

	created: Time

	package: ReadonlyDeep<ExpectedPackage.Any>

	ingestSources: Array<ExpectedPackageIngestSourcePart | ExpectedPackageIngestSourceRundownBaseline>
}
