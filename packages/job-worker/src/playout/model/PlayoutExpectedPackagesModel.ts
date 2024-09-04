import { ExpectedPackage } from '@sofie-automation/blueprints-integration'
import {
	ExpectedPackageId,
	PartInstanceId,
	PieceInstanceId,
	RundownId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'

export interface PlayoutExpectedPackagesModelReadonly {
	TODO: null
}

export interface PlayoutExpectedPackagesModel extends PlayoutExpectedPackagesModelReadonly {
	ensurePackagesExist(rundownId: RundownId, expectedPackages: ReadonlyDeep<ExpectedPackage.Any[]>): void

	setPieceInstanceReferenceToPackages(
		rundownId: RundownId,
		partInstanceId: PartInstanceId,
		pieceInstanceId: PieceInstanceId,
		expectedPackageIds: ExpectedPackageId[]
	): void
}
