import { ExpectedPackage } from '@sofie-automation/blueprints-integration'
import {
	PartInstanceId,
	PieceInstanceId,
	ExpectedPackageId,
	RundownId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { PlayoutExpectedPackagesModel, PlayoutExpectedPackagesModelSnapshot } from '../PlayoutExpectedPackagesModel'
import { PieceExpectedPackage } from '@sofie-automation/corelib/dist/dataModel/Piece'

export class PlayoutExpectedPackagesModelImpl implements PlayoutExpectedPackagesModel {
	getPackagesForPieceInstance(
		_rundownId: RundownId,
		_pieceInstanceId: PieceInstanceId
	): ReadonlyDeep<ExpectedPackage.Any>[] {
		throw new Error('Method not implemented.')
	}

	snapshotMakeCopy(): PlayoutExpectedPackagesModelSnapshot {
		throw new Error('Method not implemented.')
	}

	snapshotRestore(_snapshot: PlayoutExpectedPackagesModelSnapshot): void {
		throw new Error('Method not implemented.')
	}

	async ensurePackagesAreLoaded(_expectedPackages: PieceExpectedPackage[]): Promise<ExpectedPackage.Any[]> {
		throw new Error('Method not implemented.')
	}

	createPackagesIfMissing(_rundownId: RundownId, _expectedPackages: ReadonlyDeep<ExpectedPackage.Any[]>): void {
		throw new Error('Method not implemented.')
	}

	createPackagesIfMissingFromMap(
		_rundownId: RundownId,
		_expectedPackages: ReadonlyMap<ExpectedPackageId, ReadonlyDeep<ExpectedPackage.Any>>
	): void {
		throw new Error('Method not implemented.')
	}

	setPieceInstanceReferenceToPackages(
		_rundownId: RundownId,
		_partInstanceId: PartInstanceId,
		_pieceInstanceId: PieceInstanceId,
		_expectedPackageIds: ExpectedPackageId[]
	): void {
		throw new Error('Method not implemented.')
	}

	populateWithPackages(packages: ExpectedPackageDBNew[]): void {}

	async saveAllToDatabase(): Promise<void> {
		throw new Error('Method not implemented.')
	}
}
