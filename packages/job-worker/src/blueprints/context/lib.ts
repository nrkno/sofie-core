import {
	IBlueprintPiece,
	IBlueprintMutatablePart,
	WithTimelineObjects,
	IBlueprintPieceInstance,
	WithPieceTimelineObjects,
} from '@sofie-automation/blueprints-integration'
import { deserializePieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { unprotectObject } from '@sofie-automation/corelib/dist/protectedString'

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

	// TODO - maybe this should be a 'manual' clone, so that we know exactly what is being fed to the blueprints

	{
		// Clean out a large unused property
		const obj2 = obj.piece as unknown as Partial<PieceInstancePiece>
		delete obj2.timelineObjectsString
	}

	return obj
}
