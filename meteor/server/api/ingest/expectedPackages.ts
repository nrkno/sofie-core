import { ExpectedPackage } from '@sofie-automation/blueprints-integration'
import {
	ExpectedPackageDBBase,
	ExpectedPackageDBFromPiece,
	ExpectedPackageDBType,
	getContentVersionHash,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { ProtectedString, protectString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { PieceInstances } from '../../../lib/collections/PieceInstances'

export function generateExpectedPackagesForPartInstance(
	studio: DBStudio,
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

function generateExpectedPackageBases(
	studio: ReadonlyDeep<DBStudio>,
	ownerId: ProtectedString<any>,
	expectedPackages: ExpectedPackage.Any[]
) {
	const bases: Omit<ExpectedPackageDBBase, 'pieceId' | 'fromPieceType'>[] = []

	let i = 0
	for (const expectedPackage of expectedPackages) {
		let id = expectedPackage._id
		if (!id) id = '__unnamed' + i++

		bases.push({
			...expectedPackage,
			_id: protectString(`${ownerId}_${id}`),
			blueprintPackageId: id,
			contentVersionHash: getContentVersionHash(expectedPackage),
			studioId: studio._id,
			created: Date.now(),
		})
	}
	return bases
}
