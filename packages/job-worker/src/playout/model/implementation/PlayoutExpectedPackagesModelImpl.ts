import { ExpectedPackage } from '@sofie-automation/blueprints-integration'
import {
	PartInstanceId,
	PieceInstanceId,
	ExpectedPackageId,
	RundownId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { PlayoutExpectedPackagesModel } from '../PlayoutExpectedPackagesModel'

export class PlayoutExpectedPackagesModelImpl implements PlayoutExpectedPackagesModel {
	ensurePackagesExist(_rundownId: RundownId, _expectedPackages: ReadonlyDeep<ExpectedPackage.Any[]>): void {
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

	readonly TODO: null = null

	async saveAllToDatabase(): Promise<void> {
		throw new Error('Method not implemented.')
	}
}
