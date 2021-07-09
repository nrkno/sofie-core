import { createMongoCollection } from './lib'
import { registerIndex } from '../database'

import { PackageContainerPackageId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { PackageContainerPackageId }

import { PackageContainerPackageStatusDB } from '@sofie-automation/corelib/dist/dataModel/PackageContainerPackageStatus'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
export * from '@sofie-automation/corelib/dist/dataModel/PackageContainerPackageStatus'

export const PackageContainerPackageStatuses = createMongoCollection<
	PackageContainerPackageStatusDB,
	PackageContainerPackageStatusDB
>(CollectionName.PackageContainerPackageStatuses)

registerIndex(PackageContainerPackageStatuses, {
	studioId: 1,
	containerId: 1,
	packageId: 1,
})
