import * as _ from 'underscore'
import { TransformedCollection } from '../typings/meteor'
import {
	applyClassToDocument,
	registerCollection,
	ProtectedString,
	ProtectedStringProperties,
	protectString,
	unprotectString,
	Omit,
} from '../lib'
import {
	IBlueprintPartInstance,
	PartEndState,
	Time,
	IBlueprintPartInstanceTimings,
} from '@sofie-automation/blueprints-integration'
import { createMongoCollection } from './lib'
import { DBPart, Part } from './Parts'
import { RundownId } from './Rundowns'
import { SegmentId } from './Segments'
import { registerIndex } from '../database'

/** A string, identifying a PartInstance */
export type PartInstanceId = ProtectedString<'PartInstanceId'>
export interface InternalIBlueprintPartInstance
	extends ProtectedStringProperties<Omit<IBlueprintPartInstance, 'part'>, '_id' | 'segmentId'> {
	part: ProtectedStringProperties<
		IBlueprintPartInstance['part'],
		'_id' | 'segmentId' | 'dynamicallyInsertedAfterPartId'
	>
}
export function unprotectPartInstance(partInstance: PartInstance): IBlueprintPartInstance {
	return partInstance as any
}

export interface DBPartInstance extends InternalIBlueprintPartInstance {
	_id: PartInstanceId
	rundownId: RundownId

	/** Whether this instance has been finished with and reset (to restore the original part as the primary version) */
	reset?: boolean

	/** Rank of the take that this PartInstance belongs to */
	takeCount: number

	/** Temporarily track whether this PartInstance has been taken, so we can easily find and prune those which are only nexted */
	isTaken?: boolean

	/** Playout timings, in here we log times when playout happens */
	timings?: PartInstanceTimings

	/** If the playlist was in rehearsal mode when the PartInstance was created */
	rehearsal: boolean

	part: DBPart

	/** The end state of the previous part, to allow for bits of this to part to be based on what the previous did/was */
	previousPartEndState?: PartEndState

	/** The transition props as used when entering this PartInstance */
	allowedToUseTransition?: boolean
}

export interface PartInstanceTimings extends IBlueprintPartInstanceTimings {
	/** The playback offset that was set for the last take */
	playOffset?: Time
	/**
	 * The duration this part was playing for.
	 * This is set when the next part has started playback
	 */
	duration?: Time
}

export class PartInstance implements DBPartInstance {
	// Temporary properties (never stored in DB):
	/** Whether this PartInstance is a temprorary wrapping of a Part */
	public readonly isTemporary: boolean

	/** Whether this instance has been finished with and reset (to restore the original part as the primary version) */
	public reset?: boolean
	public takeCount: number
	public previousPartEndState?: PartEndState

	public timings?: PartInstanceTimings
	/** Temporarily track whether this PartInstance has been taken, so we can easily find and prune those which are only nexted */
	public isTaken?: boolean
	public rehearsal: boolean

	// From IBlueprintPartInstance:
	public part: Part
	public _id: PartInstanceId
	public segmentId: SegmentId
	public rundownId: RundownId

	public allowedToUseTransition?: boolean

	constructor(document: DBPartInstance, isTemporary?: boolean) {
		_.each(_.keys(document), (key) => {
			this[key] = document[key]
		})
		this.isTemporary = isTemporary === true
		this.part = new Part(document.part)
	}
}

export function wrapPartToTemporaryInstance(part: DBPart): PartInstance {
	return new PartInstance(
		{
			_id: protectString(`${part._id}_tmp_instance`),
			rundownId: part.rundownId,
			segmentId: part.segmentId,
			takeCount: -1,
			rehearsal: false,
			part: new Part(part),
		},
		true
	)
}

export function findPartInstanceOrWrapToTemporary<T extends Partial<PartInstance>>(
	partInstances: { [partId: string]: T | undefined },
	part: DBPart
): T {
	return partInstances[unprotectString(part._id)] || (wrapPartToTemporaryInstance(part) as T)
}

export const PartInstances: TransformedCollection<PartInstance, DBPartInstance> = createMongoCollection<PartInstance>(
	'partInstances',
	{ transform: (doc) => applyClassToDocument(PartInstance, doc) }
)
registerCollection('PartInstances', PartInstances)
registerIndex(PartInstances, {
	rundownId: 1,
	segmentId: 1,
	takeCount: 1,
	reset: 1,
})
registerIndex(PartInstances, {
	rundownId: 1,
	takeCount: 1,
	reset: 1,
})
registerIndex(PartInstances, {
	rundownId: 1,
	// @ts-ignore deep property
	'part._id': 1,
	takeCount: 1,
	reset: 1,
})
