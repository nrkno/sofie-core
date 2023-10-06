import { ExpectedPackageId, PackageContainerPackageId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PackageContainerPackageStatuses } from '../collections'
import {
	PackageContainerPackageStatusDB,
	getPackageContainerPackageId,
} from '../../lib/collections/PackageContainerPackageStatus'
import { ReactiveStore } from '../../lib/ReactiveStore'

export type UiPackageContainerPackageStatus = Omit<PackageContainerPackageStatusDB, 'modified'>

const storePackageContainerPackageStatuses = new ReactiveStore<
	PackageContainerPackageId,
	PackageContainerPackageStatusDB | undefined
>({
	delayUpdateTime: 1000, // delay and batch updates
})
export const getPackageContainerPackageStatus = (
	studioId: StudioId,
	packageContainerId: string,
	expectedPackageId: ExpectedPackageId
): UiPackageContainerPackageStatus | undefined => {
	const id = getPackageContainerPackageId(studioId, packageContainerId, expectedPackageId)

	return storePackageContainerPackageStatuses.getValue(id, () => {
		return PackageContainerPackageStatuses.findOne(
			{
				_id: id,
			},
			{
				projection: {
					modified: 0,
				},
			}
		)
	})
}
