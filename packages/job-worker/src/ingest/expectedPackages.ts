import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import {
	ExpectedPackageDB,
	ExpectedPackageDBType,
	ExpectedPackageDBFromPiece,
	ExpectedPackageDBFromBaselineAdLibPiece,
	ExpectedPackageDBFromAdLibAction,
	ExpectedPackageDBFromBaselineAdLibAction,
	ExpectedPackageDBFromBucketAdLib,
	ExpectedPackageDBFromBucketAdLibAction,
	ExpectedPackageDBBase,
	ExpectedPackageDBFromRundownBaselineObjects,
	ExpectedPackageDBFromStudioBaselineObjects,
	getContentVersionHash,
	getExpectedPackageId,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import {
	PartId,
	SegmentId,
	RundownId,
	AdLibActionId,
	PieceId,
	RundownBaselineAdLibActionId,
	BucketAdLibActionId,
	BucketAdLibId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { saveIntoCache } from '../cache/lib'
import { saveIntoDb } from '../db/changes'
import { CacheForPlayout } from '../playout/cache'
import { CacheForStudio } from '../studio/cache'
import { ReadonlyDeep } from 'type-fest'
import { ExpectedPackage, BlueprintResultBaseline } from '@sofie-automation/blueprints-integration'
import { updateExpectedMediaItemsOnRundown } from './expectedMediaItems'
import {
	updateBaselineExpectedPlayoutItemsOnRundown,
	updateBaselineExpectedPlayoutItemsOnStudio,
	updateExpectedPlayoutItemsOnRundown,
} from './expectedPlayoutItems'
import { JobContext } from '../jobs'
import { CacheForIngest } from './cache'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'

export async function updateExpectedPackagesOnRundown(context: JobContext, cache: CacheForIngest): Promise<void> {
	// @todo: this call is for backwards compatibility and soon to be removed
	await updateExpectedMediaItemsOnRundown(context, cache)
	await updateExpectedPlayoutItemsOnRundown(context, cache)

	const studio = context.studio

	const pieces = cache.Pieces.findAll(null)
	const adlibs = cache.AdLibPieces.findAll(null)
	const actions = cache.AdLibActions.findAll(null)

	const partToSegmentIdMap = new Map<PartId, SegmentId>()
	for (const part of cache.Parts.findAll(null)) {
		partToSegmentIdMap.set(part._id, part.segmentId)
	}

	// todo: keep expectedPackage of the currently playing partInstance

	const expectedPackages: ExpectedPackageDB[] = [
		...generateExpectedPackagesForPiece(
			studio,
			cache.RundownId,
			partToSegmentIdMap,
			pieces,
			ExpectedPackageDBType.PIECE
		),
		...generateExpectedPackagesForPiece(
			studio,
			cache.RundownId,
			partToSegmentIdMap,
			adlibs,
			ExpectedPackageDBType.ADLIB_PIECE
		),
		...generateExpectedPackagesForAdlibAction(studio, cache.RundownId, partToSegmentIdMap, actions),
	]

	// RUNDOWN_BASELINE_OBJECTS follow their own flow
	const preserveTypesDuringSave = new Set([ExpectedPackageDBType.RUNDOWN_BASELINE_OBJECTS])

	// Only regenerate the baseline types if they are already loaded into memory
	// If the cache isn't already loaded, then we haven't made any changes to the baseline adlibs
	// This means we can skip regenerating them as it is guaranteed there will be no changes
	const baselineAdlibPieceCache = cache.RundownBaselineAdLibPieces.getIfLoaded()
	if (baselineAdlibPieceCache) {
		expectedPackages.push(
			...generateExpectedPackagesForBaselineAdlibPiece(
				studio,
				cache.RundownId,
				baselineAdlibPieceCache.findAll(null)
			)
		)
	} else {
		// We haven't regenerated anything, so preserve the values in the save
		preserveTypesDuringSave.add(ExpectedPackageDBType.BASELINE_ADLIB_PIECE)
	}
	const baselineAdlibActionCache = cache.RundownBaselineAdLibActions.getIfLoaded()
	if (baselineAdlibActionCache) {
		expectedPackages.push(
			...generateExpectedPackagesForBaselineAdlibAction(
				studio,
				cache.RundownId,
				baselineAdlibActionCache.findAll(null)
			)
		)
	} else {
		// We haven't regenerated anything, so preserve the values in the save
		preserveTypesDuringSave.add(ExpectedPackageDBType.BASELINE_ADLIB_ACTION)
	}

	saveIntoCache<ExpectedPackageDB>(
		context,
		cache.ExpectedPackages,
		(p) => !preserveTypesDuringSave.has(p.fromPieceType),
		expectedPackages,
		{
			beforeUpdate: (expPackage: ExpectedPackageDB, pre?: ExpectedPackageDB) => {
				if (pre) expPackage.created = pre.created // Retain the created property
				return expPackage
			},
		}
	)
}
// export function generateExpectedPackagesForPartInstance(
// 	studio: DBStudio,
// 	rundownId: RundownId,
// 	partInstance: PartInstance
// ):Promise<void> {
// 	const packages: ExpectedPackageDBFromPiece[] = []

// 	const pieceInstances = PieceInstances.find({
// 		rundownId: rundownId,
// 		partInstanceId: partInstance._id,
// 	}).fetch()

// 	for (const pieceInstance of pieceInstances) {
// 		if (pieceInstance.piece.expectedPackages) {
// 			const bases = generateExpectedPackageBases(
// 				studio,
// 				pieceInstance.piece._id,
// 				pieceInstance.piece.expectedPackages
// 			)
// 			for (const base of bases) {
// 				packages.push({
// 					...base,
// 					rundownId,
// 					segmentId: partInstance.part.segmentId,
// 					pieceId: pieceInstance.piece._id,
// 					fromPieceType: ExpectedPackageDBType.PIECE,
// 				})
// 			}
// 		}
// 	}
// 	return packages
// }
function generateExpectedPackagesForPiece(
	studio: ReadonlyDeep<DBStudio>,
	rundownId: RundownId,
	partToSegmentIdMap: Map<PartId, SegmentId>,
	pieces: (Piece | AdLibPiece)[],
	type: ExpectedPackageDBType.PIECE | ExpectedPackageDBType.ADLIB_PIECE
) {
	const packages: ExpectedPackageDBFromPiece[] = []
	for (const piece of pieces) {
		const partId = 'startPartId' in piece ? piece.startPartId : piece.partId
		if (piece.expectedPackages && partId) {
			const segmentId = partToSegmentIdMap.get(partId)
			if (segmentId) {
				const bases = generateExpectedPackageBases(studio, piece._id, piece.expectedPackages)
				for (const base of bases) {
					packages.push({
						...base,
						rundownId,
						segmentId,
						pieceId: piece._id,
						fromPieceType: type,
					})
				}
			}
		}
	}
	return packages
}
function generateExpectedPackagesForBaselineAdlibPiece(
	studio: ReadonlyDeep<DBStudio>,
	rundownId: RundownId,
	pieces: RundownBaselineAdLibItem[]
) {
	const packages: ExpectedPackageDBFromBaselineAdLibPiece[] = []
	for (const piece of pieces) {
		if (piece.expectedPackages) {
			const bases = generateExpectedPackageBases(studio, piece._id, piece.expectedPackages)
			for (const base of bases) {
				packages.push({
					...base,
					rundownId,
					pieceId: piece._id,
					fromPieceType: ExpectedPackageDBType.BASELINE_ADLIB_PIECE,
				})
			}
		}
	}
	return packages
}
function generateExpectedPackagesForAdlibAction(
	studio: ReadonlyDeep<DBStudio>,
	rundownId: RundownId,
	partToSegmentIdMap: Map<PartId, SegmentId>,
	actions: AdLibAction[]
) {
	const packages: ExpectedPackageDBFromAdLibAction[] = []
	for (const action of actions) {
		if (action.expectedPackages) {
			const segmentId = partToSegmentIdMap.get(action.partId)
			if (segmentId) {
				const bases = generateExpectedPackageBases(studio, action._id, action.expectedPackages)
				for (const base of bases) {
					packages.push({
						...base,
						rundownId,
						segmentId,
						pieceId: action._id,
						fromPieceType: ExpectedPackageDBType.ADLIB_ACTION,
					})
				}
			}
		}
	}
	return packages
}
function generateExpectedPackagesForBaselineAdlibAction(
	studio: ReadonlyDeep<DBStudio>,
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
function generateExpectedPackagesForBucketAdlib(studio: ReadonlyDeep<DBStudio>, adlibs: BucketAdLib[]) {
	const packages: ExpectedPackageDBFromBucketAdLib[] = []
	for (const adlib of adlibs) {
		if (adlib.expectedPackages) {
			const bases = generateExpectedPackageBases(studio, adlib._id, adlib.expectedPackages)
			for (const base of bases) {
				packages.push({
					...base,
					bucketId: adlib.bucketId,
					pieceId: adlib._id,
					fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB,
				})
			}
		}
	}
	return packages
}
function generateExpectedPackagesForBucketAdlibAction(
	studio: ReadonlyDeep<DBStudio>,
	adlibActions: BucketAdLibAction[]
) {
	const packages: ExpectedPackageDBFromBucketAdLibAction[] = []
	for (const action of adlibActions) {
		if (action.expectedPackages) {
			const bases = generateExpectedPackageBases(studio, action._id, action.expectedPackages)
			for (const base of bases) {
				packages.push({
					...base,
					bucketId: action.bucketId,
					pieceId: action._id,
					fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB_ACTION,
				})
			}
		}
	}
	return packages
}
function generateExpectedPackageBases(
	studio: ReadonlyDeep<DBStudio>,
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

export async function updateExpectedPackagesForBucketAdLibPiece(
	context: JobContext,
	adlib: BucketAdLib
): Promise<void> {
	const packages = generateExpectedPackagesForBucketAdlib(context.studio, [adlib])

	await saveIntoDb(context, context.directCollections.ExpectedPackages, { pieceId: adlib._id }, packages)
}

export async function updateExpectedPackagesForBucketAdLibAction(
	context: JobContext,
	action: BucketAdLibAction
): Promise<void> {
	const packages = generateExpectedPackagesForBucketAdlibAction(context.studio, [action])

	await saveIntoDb(context, context.directCollections.ExpectedPackages, { pieceId: action._id }, packages)
}
export async function cleanUpExpectedPackagesForBucketAdLibs(context: JobContext, adLibIds: PieceId[]): Promise<void> {
	if (adLibIds.length > 0) {
		await context.directCollections.ExpectedPackages.remove({
			pieceId: {
				$in: adLibIds,
			},
		})
	}
}
export async function cleanUpExpectedPackagesForBucketAdLibsActions(
	context: JobContext,
	adLibIds: AdLibActionId[]
): Promise<void> {
	if (adLibIds.length > 0) {
		await context.directCollections.ExpectedPackages.remove({
			pieceId: {
				$in: adLibIds,
			},
		})
	}
}

export function updateBaselineExpectedPackagesOnRundown(
	context: JobContext,
	cache: CacheForIngest,
	baseline: BlueprintResultBaseline
): void {
	// @todo: this call is for backwards compatibility and soon to be removed
	updateBaselineExpectedPlayoutItemsOnRundown(context, cache, baseline.expectedPlayoutItems)

	// Fill in ids of unnamed expectedPackages
	setDefaultIdOnExpectedPackages(baseline.expectedPackages)

	const bases = generateExpectedPackageBases(context.studio, cache.RundownId, baseline.expectedPackages ?? [])
	saveIntoCache<ExpectedPackageDB>(
		context,
		cache.ExpectedPackages,
		(p) => p.fromPieceType === ExpectedPackageDBType.RUNDOWN_BASELINE_OBJECTS,
		bases.map((item): ExpectedPackageDBFromRundownBaselineObjects => {
			return {
				...item,
				fromPieceType: ExpectedPackageDBType.RUNDOWN_BASELINE_OBJECTS,
				rundownId: cache.RundownId,
				pieceId: null,
			}
		}),
		{
			beforeUpdate: (expPackage: ExpectedPackageDB, pre?: ExpectedPackageDB) => {
				if (pre) expPackage.created = pre.created // Retain the created property
				return expPackage
			},
		}
	)
}

export function updateBaselineExpectedPackagesOnStudio(
	context: JobContext,
	cache: CacheForStudio | CacheForPlayout,
	baseline: BlueprintResultBaseline
): void {
	// @todo: this call is for backwards compatibility and soon to be removed
	updateBaselineExpectedPlayoutItemsOnStudio(context, cache, baseline.expectedPlayoutItems)

	// Fill in ids of unnamed expectedPackages
	setDefaultIdOnExpectedPackages(baseline.expectedPackages)

	const bases = generateExpectedPackageBases(context.studio, context.studio._id, baseline.expectedPackages ?? [])
	cache.deferAfterSave(async () => {
		await saveIntoDb<ExpectedPackageDB>(
			context,
			context.directCollections.ExpectedPackages,
			{
				studioId: context.studio._id,
				fromPieceType: ExpectedPackageDBType.STUDIO_BASELINE_OBJECTS,
			},
			bases.map((item): ExpectedPackageDBFromStudioBaselineObjects => {
				return {
					...item,
					fromPieceType: ExpectedPackageDBType.STUDIO_BASELINE_OBJECTS,
					pieceId: null,
				}
			})
		)
	})
}

export function setDefaultIdOnExpectedPackages(expectedPackages: ExpectedPackage.Any[] | undefined): void {
	// Fill in ids of unnamed expectedPackage
	if (expectedPackages) {
		for (let i = 0; i < expectedPackages.length; i++) {
			const expectedPackage = expectedPackages[i]
			if (!expectedPackage._id) {
				expectedPackage._id = `__index${i}`
			}
		}
	}
}
