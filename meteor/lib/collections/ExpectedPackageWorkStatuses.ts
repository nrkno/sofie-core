import { createMongoCollection } from './lib'
import { registerIndex } from '../database'

import { ExpectedPackageWorkStatusId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { ExpectedPackageWorkStatusId }

import { ExpectedPackageWorkStatus } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackageWorkStatuses'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
export * from '@sofie-automation/corelib/dist/dataModel/ExpectedPackageWorkStatuses'

export const ExpectedPackageWorkStatuses = createMongoCollection<ExpectedPackageWorkStatus>(
	CollectionName.ExpectedPackageWorkStatuses
)

registerIndex(ExpectedPackageWorkStatuses, {
	studioId: 1,
	// fromPackages: 1,
})
// registerIndex(ExpectedPackageWorkStatuses, {
// 	deviceId: 1,
// })
