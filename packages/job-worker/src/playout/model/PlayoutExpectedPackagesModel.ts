import { ExpectedPackage } from '@sofie-automation/blueprints-integration'
import {
	ExpectedPackageId,
	PartInstanceId,
	PieceInstanceId,
	RundownId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'

/**
 * Token returned when making a backup copy of a PlayoutExpectedPackagesModel
 * The contents of this type is opaque and will vary fully across implementations
 */
export interface PlayoutExpectedPackagesModelSnapshot {
	__isPlayoutExpectedPackagesModelBackup: true
}

export interface PlayoutExpectedPackagesModelReadonly {
	getPackagesForPieceInstance(
		rundownId: RundownId,
		pieceInstanceId: PieceInstanceId
	): ReadonlyDeep<ExpectedPackage.Any>[]
}

export interface PlayoutExpectedPackagesModel extends PlayoutExpectedPackagesModelReadonly {
	/**
	 * Take a snapshot of the current state of this PlayoutExpectedPackagesModel
	 * This can be restored with `snapshotRestore` to rollback to a previous state of the model
	 */
	snapshotMakeCopy(): PlayoutExpectedPackagesModelSnapshot

	/**
	 * Restore a snapshot of this PlayoutExpectedPackagesModel, to rollback to a previous state
	 * Note: It is only possible to restore each snapshot once.
	 * Note: Any references to child documents may no longer be valid after this operation
	 * @param snapshot Snapshot to restore
	 */
	snapshotRestore(snapshot: PlayoutExpectedPackagesModelSnapshot): void

	ensurePackagesExist(rundownId: RundownId, expectedPackages: ReadonlyDeep<ExpectedPackage.Any[]>): void

	ensurePackagesExistMap(
		rundownId: RundownId,
		expectedPackages: ReadonlyMap<ExpectedPackageId, ReadonlyDeep<ExpectedPackage.Any>>
	): void

	setPieceInstanceReferenceToPackages(
		rundownId: RundownId,
		partInstanceId: PartInstanceId,
		pieceInstanceId: PieceInstanceId,
		expectedPackageIds: ExpectedPackageId[]
	): void
}
