import { check } from '../../../lib/check'
import { RundownId } from '../../../lib/collections/Rundowns'
import { AdLibPiece, AdLibPieces } from '../../../lib/collections/AdLibPieces'
import { protectString, waitForPromise, ProtectedString, waitForPromiseAll } from '../../../lib/lib'
import { logger } from '../../logging'
import { AdLibAction, AdLibActionId, AdLibActions } from '../../../lib/collections/AdLibActions'
import { updateExpectedMediaItemsOnRundown } from './expectedMediaItems'
import {
	ExpectedPackageDB,
	ExpectedPackageDBBase,
	ExpectedPackageDBFromAdLibAction,
	ExpectedPackageDBFromBaselineAdLibAction,
	ExpectedPackageDBFromBucketAdLib,
	ExpectedPackageDBFromBucketAdLibAction,
	ExpectedPackageDBFromPiece,
	ExpectedPackageDBType,
	ExpectedPackages,
	getContentVersionHash,
} from '../../../lib/collections/ExpectedPackages'
import { Studio, Studios } from '../../../lib/collections/Studios'
import { ExpectedPackage } from '@sofie-automation/blueprints-integration'
import { Piece, PieceId } from '../../../lib/collections/Pieces'
import { BucketAdLibAction, BucketAdLibActionId, BucketAdLibActions } from '../../../lib/collections/BucketAdlibActions'
import { Meteor } from 'meteor/meteor'
import { BucketAdLib, BucketAdLibId, BucketAdLibs } from '../../../lib/collections/BucketAdlibs'
import { RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import {
	RundownBaselineAdLibAction,
	RundownBaselineAdLibActions,
} from '../../../lib/collections/RundownBaselineAdLibActions'
import { updateExpectedPlayoutItemsOnRundown } from './expectedPlayoutItems'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { PieceInstances } from '../../../lib/collections/PieceInstances'
import { CacheForIngest } from './cache'
import { asyncCollectionFindFetch, asyncCollectionFindOne, asyncCollectionRemove, saveIntoDb } from '../../lib/database'

export function updateExpectedPackagesOnRundown(cache: CacheForIngest): void {
	// @todo: this call is for backwards compatibility and soon to be removed
	updateExpectedMediaItemsOnRundown(cache)
	updateExpectedPlayoutItemsOnRundown(cache)

	const rundown = cache.Rundown.doc
	if (!rundown) {
		cache.deferAfterSave(() => {
			const removedItems = ExpectedPackages.remove({
				rundownId: cache.RundownId,
			})
			logger.info(`Removed ${removedItems} expected packages for deleted rundown "${cache.RundownId}"`)
		})
	} else {
		const studioId = rundown.studioId

		cache.deferAfterSave(() => {
			const pAdlibs = asyncCollectionFindFetch(AdLibPieces, { rundownId: rundown._id })
			const pActions = asyncCollectionFindFetch(AdLibActions, { rundownId: rundown._id })
			const pStudio = asyncCollectionFindOne(Studios, { _id: studioId })

			const pBaselineAdlibs = asyncCollectionFindFetch(RundownBaselineAdLibPieces, { rundownId: rundown._id })
			const pBaselineActions = asyncCollectionFindFetch(RundownBaselineAdLibActions, { rundownId: rundown._id })

			const pieces = cache.Pieces.findFetch({
				startRundownId: rundown._id,
			})

			const [adlibs, actions, studio, baselineAdlibs, baselineActions] = waitForPromiseAll([
				pAdlibs,
				pActions,
				pStudio,
				pBaselineAdlibs,
				pBaselineActions,
			])

			// todo: keep expectedPackage of the currently playing partInstance
			if (!studio) throw new Error(`Studio "${studioId}" not found!`)

			const expectedPackages: ExpectedPackageDB[] = [
				...generateExpectedPackagesForPiece(studio, cache.RundownId, pieces),
				...generateExpectedPackagesForPiece(studio, cache.RundownId, adlibs),
				...generateExpectedPackagesForAdlibAction(studio, cache.RundownId, actions),

				...generateExpectedPackagesForPiece(studio, cache.RundownId, baselineAdlibs),
				...generateExpectedPackagesForBaselineAdlibAction(studio, cache.RundownId, baselineActions),
			]

			saveIntoDb<ExpectedPackageDB, ExpectedPackageDB>(
				ExpectedPackages,
				{
					rundownId: rundown._id,
				},
				expectedPackages
			)
		})
	}
}
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
					pieceId: pieceInstance.piece._id,
					fromPieceType: ExpectedPackageDBType.PIECE,
				})
			}
		}
	}
	return packages
}
function generateExpectedPackagesForPiece(studio: Studio, rundownId: RundownId, pieces: (Piece | AdLibPiece)[]) {
	const packages: ExpectedPackageDBFromPiece[] = []
	for (const piece of pieces) {
		if (piece.expectedPackages) {
			const bases = generateExpectedPackageBases(studio, piece._id, piece.expectedPackages)
			for (const base of bases) {
				packages.push({
					...base,
					rundownId,
					pieceId: piece._id,
					fromPieceType: ExpectedPackageDBType.PIECE,
				})
			}
		}
	}
	return packages
}
function generateExpectedPackagesForAdlibAction(studio: Studio, rundownId: RundownId, actions: AdLibAction[]) {
	const packages: ExpectedPackageDBFromAdLibAction[] = []
	for (const action of actions) {
		if (action.expectedPackages) {
			const bases = generateExpectedPackageBases(studio, action._id, action.expectedPackages)
			for (const base of bases) {
				packages.push({
					...base,
					rundownId,
					pieceId: action._id,
					fromPieceType: ExpectedPackageDBType.ADLIB_ACTION,
				})
			}
		}
	}
	return packages
}
function generateExpectedPackagesForBaselineAdlibAction(
	studio: Studio,
	rundownId: RundownId,
	actions: RundownBaselineAdLibAction[]
) {
	const packages: ExpectedPackageDBFromBaselineAdLibAction[] = []
	for (const action of actions) {
		if (action.expectedPackages) {
			const bases = generateExpectedPackageBases(studio, action._id, action.expectedPackages)
			for (const base of bases) {
				packages.push({
					...base,
					rundownId,
					pieceId: action._id,
					fromPieceType: ExpectedPackageDBType.BASELINE_ADLIB_ACTION,
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
	studio: Studio,
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
			contentVersionHash: getContentVersionHash(expectedPackage),
			studioId: studio._id,
		})
	}
	return bases
}

export function updateExpectedPackagesForBucketAdLib(adlibId: BucketAdLibId): void {
	check(adlibId, String)

	const adlib = BucketAdLibs.findOne(adlibId)
	if (!adlib) {
		waitForPromise(cleanUpExpectedPackagesForBucketAdLibs([adlibId]))
		throw new Meteor.Error(404, `Bucket Adlib "${adlibId}" not found!`)
	}
	const studio = Studios.findOne(adlib.studioId)
	if (!studio) throw new Meteor.Error(404, `Studio "${adlib.studioId}" not found!`)

	const packages = generateExpectedPackagesForBucketAdlib(studio, [adlib])

	saveIntoDb(ExpectedPackages, { pieceId: adlibId }, packages)
}
export function updateExpectedPackagesForBucketAdLibAction(actionId: BucketAdLibActionId): void {
	check(actionId, String)

	const action = BucketAdLibActions.findOne(actionId)
	if (!action) {
		waitForPromise(cleanUpExpectedPackagesForBucketAdLibsActions([actionId]))
		throw new Meteor.Error(404, `Bucket Action "${actionId}" not found!`)
	}
	const studio = Studios.findOne(action.studioId)
	if (!studio) throw new Meteor.Error(404, `Studio "${action.studioId}" not found!`)

	const packages = generateExpectedPackagesForBucketAdlibAction(studio, [action])

	saveIntoDb(ExpectedPackages, { pieceId: actionId }, packages)
}
export async function cleanUpExpectedPackagesForBucketAdLibs(adLibIds: PieceId[]): Promise<void> {
	check(adLibIds, [String])

	await asyncCollectionRemove(ExpectedPackages, {
		pieceId: {
			$in: adLibIds,
		},
	})
}
export async function cleanUpExpectedPackagesForBucketAdLibsActions(adLibIds: AdLibActionId[]): Promise<void> {
	check(adLibIds, [String])

	await asyncCollectionRemove(ExpectedPackages, {
		pieceId: {
			$in: adLibIds,
		},
	})
}
