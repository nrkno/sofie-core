import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { PackageInfoDB } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'
import { getCurrentTime } from '../lib'
export * from '@sofie-automation/corelib/dist/dataModel/PackageInfos'

export const PackageInfos = createMongoCollection<PackageInfoDB>(CollectionName.PackageInfos)

registerIndex(PackageInfos, {
	studioId: 1,
	packageId: 1,
})
/** Returns a list of PackageInfos which are no longer valid */
export async function getRemovedPackageInfos(): Promise<PackageInfoDB['_id'][]> {
	const docs = await PackageInfos.findFetchAsync({ removeTime: { $lte: getCurrentTime() } }, { fields: { _id: 1 } })
	return docs.map((p) => p._id)
}
