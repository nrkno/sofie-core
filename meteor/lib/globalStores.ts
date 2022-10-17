import { ExpectedPackageId, PackageContainerPackageId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	PackageContainerPackageStatusDB,
	getPackageContainerPackageId,
	PackageContainerPackageStatuses,
} from './collections/PackageContainerPackageStatus'
import { ReactiveStore } from './ReactiveStore'

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
): PackageContainerPackageStatusDB | undefined => {
	const id = getPackageContainerPackageId(studioId, packageContainerId, expectedPackageId)

	return storePackageContainerPackageStatuses.getValue(id, () => {
		return PackageContainerPackageStatuses.findOne({
			_id: id,
		})
	})
}
