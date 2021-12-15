import { registerCollection, ProtectedString, ProtectedStringProperties, protectString, unprotectString } from '../lib'
import { IBlueprintPartInstance, Time, IBlueprintPartInstanceTimings } from '@sofie-automation/blueprints-integration'
import { createMongoCollection } from './lib'
import { DBPart, PartId } from './Parts'
import { RundownId } from './Rundowns'
import { SegmentId } from './Segments'
import { registerIndex } from '../database'
import { RundownPlaylistActivationId } from './RundownPlaylists'
import { PartialDeep } from 'type-fest'

/** A string, identifying a PartInstance */
export type PartInstanceId = ProtectedString<'PartInstanceId'>
export type SegmentPlayoutId = ProtectedString<'SegmentPlayoutId'>
export interface InternalIBlueprintPartInstance
	extends ProtectedStringProperties<Omit<IBlueprintPartInstance, 'part'>, '_id' | 'segmentId'> {
	part: ProtectedStringProperties<IBlueprintPartInstance['part'], '_id' | 'segmentId'>
}

export function unprotectPartInstance(partInstance: PartInstance): IBlueprintPartInstance
export function unprotectPartInstance(partInstance: PartInstance | undefined): IBlueprintPartInstance | undefined
export function unprotectPartInstance(partInstance: PartInstance | undefined): IBlueprintPartInstance | undefined {
	return partInstance as any
}
export function unprotectPartInstanceArray(partInstances: PartInstance[]): IBlueprintPartInstance[] {
	return partInstances as any
}
export function protectPartInstance(partInstance: IBlueprintPartInstance): PartialDeep<PartInstance> {
	return partInstance as any
}

export interface PartInstance extends InternalIBlueprintPartInstance {
	// Temporary properties (never stored in DB):
	/** Whether this PartInstance is a temprorary wrapping of a Part */
	readonly isTemporary?: boolean

	_id: PartInstanceId
	rundownId: RundownId
	segmentId: SegmentId

	/** The id of the playlist activation session */
	playlistActivationId: RundownPlaylistActivationId
	/** The id of the segment playout. This is unique for each session, and each time the segment is entered  */
	segmentPlayoutId: SegmentPlayoutId

	/** Whether this instance has been finished with and reset (to restore the original part as the primary version) */
	reset?: boolean

	/** Rank of the take that this PartInstance belongs to */
	takeCount: number

	/** Whether this instance was created because of RundownPlaylist.nextSegmentId. This will cause it to clear that property as part of the take operation */
	consumesNextSegmentId?: boolean

	/** Temporarily track whether this PartInstance has been taken, so we can easily find and prune those which are only nexted */
	isTaken?: boolean

	/** Playout timings, in here we log times when playout happens */
	timings?: PartInstanceTimings

	part: DBPart

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

/** Note: Use PartInstance instead */
export type DBPartInstance = PartInstance

export function wrapPartToTemporaryInstance(
	playlistActivationId: RundownPlaylistActivationId,
	part: DBPart
): PartInstance {
	return {
		isTemporary: true,
		_id: protectString(`${part._id}_tmp_instance`),
		rundownId: part.rundownId,
		segmentId: part.segmentId,
		playlistActivationId,
		segmentPlayoutId: protectString(''), // Only needed when stored in the db, and filled in nearer the time
		takeCount: -1,
		rehearsal: false,
		part: part,
	}
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

export const PartInstances = createMongoCollection<PartInstance>('partInstances')
registerCollection('PartInstances', PartInstances)
registerIndex(PartInstances, {
	rundownId: 1,
	playlistActivationId: 1,
	reset: 1,
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
