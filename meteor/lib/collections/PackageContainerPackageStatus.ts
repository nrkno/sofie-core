import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { PackageContainerPackageStatusDB } from '@sofie-automation/corelib/dist/dataModel/PackageContainerPackageStatus'
export * from '@sofie-automation/corelib/dist/dataModel/PackageContainerPackageStatus'

export const PackageContainerPackageStatuses = createMongoCollection<PackageContainerPackageStatusDB>(
	CollectionName.PackageContainerPackageStatuses
)

registerIndex(PackageContainerPackageStatuses, {
	studioId: 1,
	containerId: 1,
	packageId: 1,
})
registerIndex(PackageContainerPackageStatuses, {
	deviceId: 1,
})
