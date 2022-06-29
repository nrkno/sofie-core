import { ExpectedPackage } from '@sofie-automation/blueprints-integration'
import {
	ExpectedPackageDBBase,
	ExpectedPackageDBFromPiece,
	ExpectedPackageDBType,
	getContentVersionHash,
	getExpectedPackageId,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import {
	AdLibActionId,
	BucketAdLibActionId,
	BucketAdLibId,
	PieceId,
	RundownBaselineAdLibActionId,
	RundownId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { StudioLight } from '../../../lib/collections/optimizations'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { PieceInstances } from '../../../lib/collections/PieceInstances'

export function generateExpectedPackagesForPartInstance(
	studio: StudioLight,
	rundownId: RundownId,
	partInstance: PartInstance
) {
	const packages: ExpectedPackageDBFromPiece[] = []

	const pieceInstances = PieceInstances.find({
		rundownId: rundownId,
		partInstanceId: partInstance._id,
	}).fetch()

	for (const pieceInstance of pieceInstances) {
		if (pieceInstance.piece.expectedPackages) {
			const bases = generateExpectedPackageBases(
				studio,
				pieceInstance.piece._id,
				pieceInstance.piece.expectedPackages
			)
			for (const base of bases) {
				packages.push({
					...base,
					rundownId,
					segmentId: partInstance.part.segmentId,
					pieceId: pieceInstance.piece._id,
					fromPieceType: ExpectedPackageDBType.PIECE,
				})
			}
		}
	}
	return packages
}

// TODO - this is duplicated in the job-worker
function generateExpectedPackageBases(
	studio: ReadonlyDeep<StudioLight>,
	ownerId:
		| PieceId
		| AdLibActionId
		| RundownBaselineAdLibActionId
		| BucketAdLibId
		| BucketAdLibActionId
		| RundownId
		| StudioId,
	expectedPackages: ExpectedPackage.Any[]
) {
	const bases: Omit<ExpectedPackageDBBase, 'pieceId' | 'fromPieceType'>[] = []

	for (let i = 0; i < expectedPackages.length; i++) {
		const expectedPackage = expectedPackages[i]
		const id = expectedPackage._id || '__unnamed' + i

		bases.push({
			...expectedPackage,
			_id: getExpectedPackageId(ownerId, id),
			blueprintPackageId: id,
			contentVersionHash: getContentVersionHash(expectedPackage),
			studioId: studio._id,
			created: Date.now(),
		})
	}
	return bases
}
