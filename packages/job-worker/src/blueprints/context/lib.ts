import {
	IBlueprintPiece,
	IBlueprintMutatablePart,
	WithTimelineObjects,
	IBlueprintPieceInstance,
	WithPieceTimelineObjects,
	IBlueprintPartInstance,
	IBlueprintResolvedPieceInstance,
	IBlueprintPartDB,
	IBlueprintAdLibPieceDB,
	IBlueprintActionManifest,
	IBlueprintShowStyleBase,
	IBlueprintShowStyleVariant,
	IBlueprintRundownDB,
} from '@sofie-automation/blueprints-integration'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import {
	deserializePieceTimelineObjectsBlob,
	EmptyPieceTimelineObjectsBlob,
} from '@sofie-automation/corelib/dist/dataModel/Piece'
import {
	PieceInstance,
	PieceInstancePiece,
	ResolvedPieceInstance,
} from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { unprotectObject } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'

/**
 * Convert an object to have all the values of all keys (including optionals) be 'true'
 * This simplifies the definitions for
 */
type AllValuesAsTrue<T> = {
	[K in keyof Required<T>]: true
}
function allKeysOfObject<T>(sample: AllValuesAsTrue<T>): Array<keyof T> {
	return Object.keys(sample) as Array<keyof T>
}

// Compile a list of the keys which are allowed to be set
export const IBlueprintPieceWithTimelineObjectsSampleKeys = allKeysOfObject<WithTimelineObjects<IBlueprintPiece>>({
	externalId: true,
	enable: true,
	virtual: true,
	continuesRefId: true,
	pieceType: true,
	extendOnHold: true,
	name: true,
	metaData: true,
	sourceLayerId: true,
	outputLayerId: true,
	content: true,
	transitions: true,
	lifespan: true,
	prerollDuration: true,
	toBeQueued: true,
	expectedPlayoutItems: true,
	tags: true,
	expectedPackages: true,
	hasSideEffects: true,
	allowDirectPlay: true,
	notInVision: true,
	timelineObjects: true,
})

// Compile a list of the keys which are allowed to be set
export const IBlueprintMutatablePartSampleKeys = allKeysOfObject<IBlueprintMutatablePart>({
	title: true,
	metaData: true,
	autoNext: true,
	autoNextOverlap: true,
	inTransition: true,
	disableNextInTransition: true,
	outTransition: true,
	expectedDuration: true,
	budgetDuration: true,
	holdMode: true,
	shouldNotifyCurrentPlayingPart: true,
	classes: true,
	classesForNext: true,
	displayDurationGroup: true,
	displayDuration: true,
	identifier: true,
})

// TODO - maybe these functions should be a 'manual' clone, so that we know exactly what is being fed to the blueprints

export function convertPieceInstanceToBlueprints(pieceInstance: PieceInstance): IBlueprintPieceInstance {
	const cloned = clone(pieceInstance)
	// Prune out this large and hidden value
	cloned.piece.timelineObjectsString = EmptyPieceTimelineObjectsBlob

	const obj: IBlueprintPieceInstance = unprotectObject(cloned)

	return obj
}

export function convertPieceInstanceToBlueprintsWithTimelineObjects(
	pieceInstance: PieceInstance
): WithPieceTimelineObjects<IBlueprintPieceInstance> {
	const cloned = clone(pieceInstance)

	const obj: WithPieceTimelineObjects<IBlueprintPieceInstance> = {
		...unprotectObject(cloned),
		piece: {
			...unprotectObject(cloned.piece),
			timelineObjects: deserializePieceTimelineObjectsBlob(pieceInstance.piece.timelineObjectsString),
		},
	}

	{
		// Clean out a large unused property
		const obj2 = obj.piece as unknown as Partial<PieceInstancePiece>
		delete obj2.timelineObjectsString
	}

	return obj
}

export function convertResolvedPieceInstanceToBlueprints(
	pieceInstance: ResolvedPieceInstance
): IBlueprintResolvedPieceInstance {
	const cloned = clone(pieceInstance)
	// Prune out this large and hidden value
	cloned.piece.timelineObjectsString = EmptyPieceTimelineObjectsBlob

	const obj: IBlueprintResolvedPieceInstance = unprotectObject(cloned)

	return obj
}

export function convertPartInstanceToBlueprints(partInstance: DBPartInstance): IBlueprintPartInstance {
	const cloned = clone(partInstance)

	return cloned as any
}

export function convertPartToBlueprints(part: DBPart): IBlueprintPartDB {
	return unprotectObject(clone(part))
}
export function convertAdLibPieceToBlueprints(adLib: AdLibPiece): WithTimelineObjects<IBlueprintAdLibPieceDB> {
	const cloned = clone(adLib)

	const obj: WithTimelineObjects<IBlueprintAdLibPieceDB> = {
		...unprotectObject(cloned),
		timelineObjects: deserializePieceTimelineObjectsBlob(adLib.timelineObjectsString),
	}

	{
		// Clean out a large unused property
		const obj2 = obj as unknown as Partial<AdLibPiece>
		delete obj2.timelineObjectsString
	}

	return obj
}
export function convertAdLibActionToBlueprints(action: AdLibAction): IBlueprintActionManifest {
	return unprotectObject(clone(action))
}

export function convertRundownToBlueprints(rundown: ReadonlyDeep<DBRundown>): IBlueprintRundownDB {
	return unprotectObject(clone(rundown))
}

export function convertShowStyleBaseToBlueprints(
	showStyleBase: ReadonlyDeep<DBShowStyleBase>
): IBlueprintShowStyleBase {
	return unprotectObject(clone<DBShowStyleBase>(showStyleBase))
}
export function convertShowStyleVariantToBlueprints(
	showStyleVariant: ReadonlyDeep<DBShowStyleVariant>
): IBlueprintShowStyleVariant {
	return unprotectObject(clone<DBShowStyleVariant>(showStyleVariant))
}
