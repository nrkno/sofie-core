import { check } from '../../../lib/check'
import { RundownId } from '../../../lib/collections/Rundowns'
import { protectString, ProtectedString } from '../../../lib/lib'
import { AdLibActionId } from '../../../lib/collections/AdLibActions'
import {
	ExpectedPackageDBBase,
	ExpectedPackageDBFromBucketAdLib,
	ExpectedPackageDBFromBucketAdLibAction,
	ExpectedPackageDBFromPiece,
	ExpectedPackageDBType,
	ExpectedPackages,
	getContentVersionHash,
} from '../../../lib/collections/ExpectedPackages'
import { Studio, Studios } from '../../../lib/collections/Studios'
import { ExpectedPackage } from '@sofie-automation/blueprints-integration'
import { PieceId } from '../../../lib/collections/Pieces'
import { BucketAdLibAction, BucketAdLibActions } from '../../../lib/collections/BucketAdlibActions'
import { Meteor } from 'meteor/meteor'
import { BucketAdLib, BucketAdLibs } from '../../../lib/collections/BucketAdlibs'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { PieceInstances } from '../../../lib/collections/PieceInstances'
import { saveIntoDb } from '../../lib/database'
import { ReadonlyDeep } from 'type-fest'
import { BucketAdLibActionId, BucketAdLibId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export function generateExpectedPackagesForPartInstance(
	studio: Studio,
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
function generateExpectedPackagesForBucketAdlib(studio: Studio, adlibs: BucketAdLib[]) {
	const packages: ExpectedPackageDBFromBucketAdLib[] = []
	for (const adlib of adlibs) {
		if (adlib.expectedPackages) {
			const bases = generateExpectedPackageBases(studio, adlib._id, adlib.expectedPackages)
			for (const base of bases) {
				packages.push({
					...base,
					pieceId: adlib._id,
					fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB,
				})
			}
		}
	}
	return packages
}
function generateExpectedPackagesForBucketAdlibAction(studio: Studio, adlibActions: BucketAdLibAction[]) {
	const packages: ExpectedPackageDBFromBucketAdLibAction[] = []
	for (const action of adlibActions) {
		if (action.expectedPackages) {
			const bases = generateExpectedPackageBases(studio, action._id, action.expectedPackages)
			for (const base of bases) {
				packages.push({
					...base,
					pieceId: action._id,
					fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB_ACTION,
				})
			}
		}
	}
	return packages
}
function generateExpectedPackageBases(
	studio: ReadonlyDeep<Studio>,
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

export async function updateExpectedPackagesForBucketAdLib(adlibId: BucketAdLibId): Promise<void> {
	check(adlibId, String)

	const adlib = await BucketAdLibs.findOneAsync(adlibId)
	if (!adlib) {
		await cleanUpExpectedPackagesForBucketAdLibs([adlibId])
		throw new Meteor.Error(404, `Bucket Adlib "${adlibId}" not found!`)
	}
	const studio = await Studios.findOneAsync(adlib.studioId)
	if (!studio) throw new Meteor.Error(404, `Studio "${adlib.studioId}" not found!`)

	const packages = generateExpectedPackagesForBucketAdlib(studio, [adlib])

	await saveIntoDb(ExpectedPackages, { pieceId: adlibId }, packages)
}
export async function updateExpectedPackagesForBucketAdLibAction(actionId: BucketAdLibActionId): Promise<void> {
	check(actionId, String)

	const action = await BucketAdLibActions.findOneAsync(actionId)
	if (!action) {
		await cleanUpExpectedPackagesForBucketAdLibsActions([actionId])
		throw new Meteor.Error(404, `Bucket Action "${actionId}" not found!`)
	}
	const studio = await Studios.findOneAsync(action.studioId)
	if (!studio) throw new Meteor.Error(404, `Studio "${action.studioId}" not found!`)

	const packages = generateExpectedPackagesForBucketAdlibAction(studio, [action])

	await saveIntoDb(ExpectedPackages, { pieceId: actionId }, packages)
}
export async function cleanUpExpectedPackagesForBucketAdLibs(adLibIds: PieceId[]): Promise<void> {
	check(adLibIds, [String])

	await ExpectedPackages.removeAsync({
		pieceId: {
			$in: adLibIds,
		},
	})
}
export async function cleanUpExpectedPackagesForBucketAdLibsActions(adLibIds: AdLibActionId[]): Promise<void> {
	check(adLibIds, [String])

	await ExpectedPackages.removeAsync({
		pieceId: {
			$in: adLibIds,
		},
	})
}
