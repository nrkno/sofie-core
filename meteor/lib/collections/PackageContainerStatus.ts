import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { PackageContainerStatusDB } from '@sofie-automation/corelib/dist/dataModel/PackageContainerStatus'
export * from '@sofie-automation/corelib/dist/dataModel/PackageContainerStatus'

export const PackageContainerStatuses = createMongoCollection<PackageContainerStatusDB>(
	CollectionName.PackageContainerStatuses
)

registerIndex(PackageContainerStatuses, {
	studioId: 1,
	containerId: 1,
})
registerIndex(PackageContainerStatuses, {
	deviceId: 1,
})
