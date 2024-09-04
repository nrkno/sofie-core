import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import {
	ExpectedPackageDBType,
	ExpectedPackageDBFromBucketAdLib,
	ExpectedPackageDBFromBucketAdLibAction,
	ExpectedPackageDBFromStudioBaselineObjects,
	getContentVersionHash,
	getExpectedPackageId,
	ExpectedPackageDBBaseSimple,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import {
	RundownId,
	AdLibActionId,
	PieceId,
	RundownBaselineAdLibActionId,
	BucketAdLibActionId,
	BucketAdLibId,
	StudioId,
	PieceInstanceId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { saveIntoDb } from '../db/changes'
import { PlayoutModel } from '../playout/model/PlayoutModel'
import { StudioPlayoutModel } from '../studio/model/StudioPlayoutModel'
import { ReadonlyDeep } from 'type-fest'
import { ExpectedPackage, BlueprintResultBaseline } from '@sofie-automation/blueprints-integration'
import { updateExpectedMediaItemsForPartModel, updateExpectedMediaItemsForRundownBaseline } from './expectedMediaItems'
import {
	updateBaselineExpectedPlayoutItemsOnStudio,
	updateExpectedPlayoutItemsForPartModel,
	updateExpectedPlayoutItemsForRundownBaseline,
} from './expectedPlayoutItems'
import { JobContext } from '../jobs'
import { IngestModel } from './model/IngestModel'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { IngestPartModel } from './model/IngestPartModel'
import { clone } from '@sofie-automation/corelib/dist/lib'

export function updateExpectedMediaAndPlayoutItemsForPartModel(context: JobContext, part: IngestPartModel): void {
	updateExpectedMediaItemsForPartModel(context, part)
	updateExpectedPlayoutItemsForPartModel(context, part)
}

export async function updateExpectedMediaAndPlayoutItemsForRundownBaseline(
	context: JobContext,
	ingestModel: IngestModel,
	baseline: BlueprintResultBaseline | undefined
): Promise<void> {
	await updateExpectedMediaItemsForRundownBaseline(context, ingestModel)
	await updateExpectedPlayoutItemsForRundownBaseline(context, ingestModel, baseline)
}

function generateExpectedPackagesForBucketAdlib(studio: ReadonlyDeep<DBStudio>, adlibs: BucketAdLib[]) {
	const packages: ExpectedPackageDBFromBucketAdLib[] = []
	for (const adlib of adlibs) {
		if (adlib.expectedPackages) {
			const bases = generateExpectedPackageBases(studio._id, adlib._id, adlib.expectedPackages)
			for (const base of bases) {
				packages.push({
					...base,
					bucketId: adlib.bucketId,
					pieceId: adlib._id,
					pieceExternalId: adlib.externalId,
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
			const bases = generateExpectedPackageBases(studio._id, action._id, action.expectedPackages)
			for (const base of bases) {
				packages.push({
					...base,
					bucketId: action.bucketId,
					pieceId: action._id,
					pieceExternalId: action.externalId,
					fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB_ACTION,
				})
			}
		}
	}
	return packages
}
function generateExpectedPackageBases(
	studioId: StudioId,
	ownerId:
		| PieceId
		| AdLibActionId
		| RundownBaselineAdLibActionId
		| BucketAdLibId
		| BucketAdLibActionId
		| RundownId
		| StudioId
		| PieceInstanceId,
	expectedPackages: ReadonlyDeep<ExpectedPackage.Any[]>
): ExpectedPackageDBBaseSimple[] {
	const bases: ExpectedPackageDBBaseSimple[] = []

	for (let i = 0; i < expectedPackages.length; i++) {
		const expectedPackage = expectedPackages[i]
		const id = expectedPackage._id || '__unnamed' + i

		bases.push({
			package: clone<ExpectedPackage.Any>(expectedPackage),
			_id: getExpectedPackageId(ownerId, id),
			blueprintPackageId: id,
			contentVersionHash: getContentVersionHash(expectedPackage),
			studioId: studioId,
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

export function updateBaselineExpectedPackagesOnStudio(
	context: JobContext,
	playoutModel: StudioPlayoutModel | PlayoutModel,
	baseline: BlueprintResultBaseline
): void {
	updateBaselineExpectedPlayoutItemsOnStudio(context, playoutModel, baseline.expectedPlayoutItems ?? [])

	// Fill in ids of unnamed expectedPackages
	setDefaultIdOnExpectedPackages(baseline.expectedPackages)

	const bases = generateExpectedPackageBases(context.studio._id, context.studio._id, baseline.expectedPackages ?? [])
	playoutModel.setExpectedPackagesForStudioBaseline(
		bases.map((item): ExpectedPackageDBFromStudioBaselineObjects => {
			return {
				...item,
				fromPieceType: ExpectedPackageDBType.STUDIO_BASELINE_OBJECTS,
				pieceId: null,
			}
		})
	)
}

export function setDefaultIdOnExpectedPackages(
	expectedPackages: ExpectedPackage.Any[] | undefined
): ExpectedPackage.Any[] {
	// Fill in ids of unnamed expectedPackage
	if (!expectedPackages) return []

	for (let i = 0; i < expectedPackages.length; i++) {
		const expectedPackage = expectedPackages[i]
		if (!expectedPackage._id) {
			expectedPackage._id = `__index${i}`
		}
	}

	return expectedPackages
}
