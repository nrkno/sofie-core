import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { PackageInfoDB } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'
export * from '@sofie-automation/corelib/dist/dataModel/PackageInfos'

export const PackageInfos = createMongoCollection<PackageInfoDB>(CollectionName.PackageInfos)

registerIndex(PackageInfos, {
	studioId: 1,
	packageId: 1,
})
