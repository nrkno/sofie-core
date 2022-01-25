import { IBlueprintPiece, IBlueprintMutatablePart } from '@sofie-automation/blueprints-integration'

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
export const IBlueprintPieceSampleKeys = allKeysOfObject<IBlueprintPiece>({
	externalId: true,
	enable: true,
	virtual: true,
	continuesRefId: true,
	isTransition: true,
	extendOnHold: true,
	name: true,
	metaData: true,
	sourceLayerId: true,
	outputLayerId: true,
	content: true,
	transitions: true,
	lifespan: true,
	adlibPreroll: true,
	toBeQueued: true,
	expectedPlayoutItems: true,
	adlibAutoNext: true,
	adlibAutoNextOverlap: true,
	adlibDisableOutTransition: true,
	adlibTransitionKeepAlive: true,
	tags: true,
	expectedPackages: true,
	hasSideEffects: true,
	allowDirectPlay: true,
	notInVision: true,
})

// Compile a list of the keys which are allowed to be set
export const IBlueprintMutatablePartSampleKeys = allKeysOfObject<IBlueprintMutatablePart>({
	title: true,
	metaData: true,
	autoNext: true,
	autoNextOverlap: true,
	prerollDuration: true,
	transitionPrerollDuration: true,
	transitionKeepaliveDuration: true,
	transitionDuration: true,
	disableOutTransition: true,
	expectedDuration: true,
	holdMode: true,
	shouldNotifyCurrentPlayingPart: true,
	classes: true,
	classesForNext: true,
	displayDurationGroup: true,
	displayDuration: true,
	identifier: true,
	budgetDuration: true,
	hackListenToMediaObjectUpdates: true,
})
