import { Segments, Segment } from './Segments'
import { Parts, Part, DBPart } from './Parts'
import { FindOptions, MongoQuery } from '../typings/meteor'
import { Meteor } from 'meteor/meteor'
import { ShowStyleVariant, ShowStyleVariants } from './ShowStyleVariants'
import { ShowStyleBase, ShowStyleBases } from './ShowStyleBases'
import { RundownPlaylists, RundownPlaylist } from './RundownPlaylists'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { sortPartsInSortedSegments } from '@sofie-automation/corelib/dist/playout/playlist'

import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { RundownId }

import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
export { RundownHoldState }

import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
export * from '@sofie-automation/corelib/dist/dataModel/Rundown'

/**
 * Direct database accessors for the Rundown
 * These used to reside on the Rundown class
 */
export class RundownCollectionUtil {
	static getRundownPlaylist(rundown: Pick<DBRundown, 'playlistId'>): RundownPlaylist {
		if (!rundown.playlistId) throw new Meteor.Error(500, 'Rundown is not a part of a rundown playlist!')
		const pls = RundownPlaylists.findOne(rundown.playlistId)
		if (pls) {
			return pls
		} else throw new Meteor.Error(404, `Rundown Playlist "${rundown.playlistId}" not found!`)
	}
	static getShowStyleVariant(rundown: Pick<DBRundown, 'showStyleVariantId'>): ShowStyleVariant {
		const showStyleVariant = ShowStyleVariants.findOne(rundown.showStyleVariantId)
		if (!showStyleVariant)
			throw new Meteor.Error(404, `ShowStyleVariant "${rundown.showStyleVariantId}" not found!`)
		return showStyleVariant
	}
	static getShowStyleBase(rundown: Pick<DBRundown, 'showStyleBaseId'>): ShowStyleBase {
		const showStyleBase = ShowStyleBases.findOne(rundown.showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase "${rundown.showStyleBaseId}" not found!`)
		return showStyleBase
	}
	static getSegments(
		rundown: Pick<DBRundown, '_id'>,
		selector?: MongoQuery<Segment>,
		options?: FindOptions<Segment>
	): Segment[] {
		return Segments.find(
			{
				rundownId: rundown._id,
				...selector,
			},
			{
				sort: { _rank: 1 },
				...options,
			}
		).fetch()
	}
	static getParts(
		rundown: Pick<DBRundown, '_id'>,
		selector?: MongoQuery<Part>,
		options?: FindOptions<DBPart>,
		segmentsInOrder?: Array<Pick<Segment, '_id'>>
	): Part[] {
		const parts = Parts.find(
			{
				rundownId: rundown._id,
				...selector,
			},
			{
				sort: { _rank: 1 },
				...options,
			}
		).fetch()

		if (options?.sort) {
			// User explicitly sorted the parts
			return parts
		} else {
			// Default to sorting within the rundown
			return sortPartsInSortedSegments(
				parts,
				segmentsInOrder || RundownCollectionUtil.getSegments(rundown, undefined, { fields: { _id: 1 } })
			)
		}
	}
	/** Synchronous version of getSegmentsAndParts, to be used client-side */
	static getSegmentsAndPartsSync(rundown: Pick<DBRundown, '_id'>): { segments: Segment[]; parts: Part[] } {
		const segments = RundownCollectionUtil.getSegments(rundown)
		const parts = RundownCollectionUtil.getParts(rundown, undefined, undefined, segments)

		return {
			segments: segments,
			parts: parts,
		}
	}
}

// export const Rundowns = createMongoCollection<Rundown>('rundowns', {transform: (doc) => applyClassToDocument(Rundown, doc) })
export const Rundowns = createMongoCollection<DBRundown>(CollectionName.Rundowns)

registerIndex(Rundowns, {
	playlistId: 1,
})
registerIndex(Rundowns, {
	playlistExternalId: 1,
})
