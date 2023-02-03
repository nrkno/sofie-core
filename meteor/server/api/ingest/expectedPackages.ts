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
import { PartInstance } from '../../../lib/collections/PartInstances'
import { PieceInstancePiece } from '../../../lib/collections/PieceInstances'
import { PieceInstances } from '../../collections'

export async function generateExpectedPackagesForPartInstance(
	studioId: StudioId,
	rundownId: RundownId,
	partInstance: PartInstance
): Promise<ExpectedPackageDBFromPiece[]> {
	const packages: ExpectedPackageDBFromPiece[] = []

	const pieceInstances = (await PieceInstances.findFetchAsync(
		{
			rundownId: rundownId,
			partInstanceId: partInstance._id,
		},
		{
			fields: {
				// @ts-expect-error deep property
				'piece._id': 1,
				'piece.expectedPackages': 1,
			},
		}
	)) as Array<{ piece: Pick<PieceInstancePiece, '_id' | 'expectedPackages'> }>

	for (const pieceInstance of pieceInstances) {
		if (pieceInstance.piece.expectedPackages) {
			const bases = generateExpectedPackageBases(
				studioId,
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
	studioId: StudioId,
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
			studioId: studioId,
			created: Date.now(),
		})
	}
	return bases
}
