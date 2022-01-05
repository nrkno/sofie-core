import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { PackageInfoId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { PackageInfoId }

import { PackageInfoDB } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'
export * from '@sofie-automation/corelib/dist/dataModel/PackageInfos'

export const PackageInfos = createMongoCollection<PackageInfoDB>(CollectionName.PackageInfos)

registerIndex(PackageInfos, {
	studioId: 1,
	packageId: 1,
})
