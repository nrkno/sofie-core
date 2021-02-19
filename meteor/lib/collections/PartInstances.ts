import * as _ from 'underscore'
import { applyClassToDocument, protectString, unprotectString } from '../lib'
import { PartEndState } from '@sofie-automation/blueprints-integration'
import { createMongoCollection } from './lib'
import { DBPart, Part } from './Parts'
import { registerIndex } from '../database'
import {
	PartInstanceId,
	SegmentPlayoutId,
	PartId,
	RundownPlaylistActivationId,
	SegmentId,
	RundownId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
export { PartInstanceId, SegmentPlayoutId }
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { DBPartInstance, PartInstanceTimings } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
export * from '@sofie-automation/corelib/dist/dataModel/PartInstance'

export class PartInstance implements DBPartInstance {
	// Temporary properties (never stored in DB):
	/** Whether this PartInstance is a temprorary wrapping of a Part */
	public readonly isTemporary: boolean

	public playlistActivationId: RundownPlaylistActivationId
	public segmentPlayoutId: SegmentPlayoutId
	/** Whether this instance has been finished with and reset (to restore the original part as the primary version) */
	public reset?: boolean
	public takeCount: number
	public consumesNextSegmentId?: boolean
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

	public orphaned?: 'adlib-part' | 'deleted'

	constructor(document: DBPartInstance, isTemporary?: boolean) {
		_.each(_.keys(document), (key) => {
			this[key] = document[key]
		})
		this.isTemporary = isTemporary === true
		this.part = new Part(document.part)
	}
}

export function wrapPartToTemporaryInstance(
	playlistActivationId: RundownPlaylistActivationId,
	part: DBPart
): PartInstance {
	return new PartInstance(
		{
			_id: protectString(`${part._id}_tmp_instance`),
			rundownId: part.rundownId,
			segmentId: part.segmentId,
			playlistActivationId,
			segmentPlayoutId: protectString(''), // Only needed when stored in the db, and filled in nearer the time
			takeCount: -1,
			rehearsal: false,
			part: new Part(part),
		},
		true
	)
}

export function findPartInstanceInMapOrWrapToTemporary<T extends Partial<PartInstance>>(
	partInstancesMap: Map<PartId, T>,
	part: DBPart
): T {
	return partInstancesMap.get(part._id) || (wrapPartToTemporaryInstance(protectString(''), part) as T)
}

export function findPartInstanceOrWrapToTemporary<T extends Partial<PartInstance>>(
	partInstances: { [partId: string]: T | undefined },
	part: DBPart
): T {
	return partInstances[unprotectString(part._id)] || (wrapPartToTemporaryInstance(protectString(''), part) as T)
}

export const PartInstances = createMongoCollection<PartInstance, DBPartInstance>(CollectionName.PartInstances, {
	transform: (doc) => applyClassToDocument(PartInstance, doc),
})

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
