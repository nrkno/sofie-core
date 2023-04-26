import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { ReactiveCacheCollection } from '../lib/ReactiveCacheCollection'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { IncludeAllMongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { PartInstance } from '../../../lib/collections/PartInstances'

export type RundownFields = '_id' | 'playlistId' | 'externalNRCSName'
export const rundownFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<RundownFields>>({
	_id: 1,
	playlistId: 1,
	externalNRCSName: 1,
})

export type SegmentFields = '_id' | '_rank' | 'rundownId' | 'name' | 'notes' | 'orphaned'
export const segmentFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<SegmentFields>>({
	_id: 1,
	_rank: 1,
	rundownId: 1,
	name: 1,
	notes: 1,
	orphaned: 1,
})

export type PartFields = '_id' | '_rank' | 'segmentId' | 'rundownId' | 'notes' | 'title' | 'invalid' | 'invalidReason'
export const partFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<PartFields>>({
	_id: 1,
	_rank: 1,
	segmentId: 1,
	rundownId: 1,
	notes: 1,
	title: 1,
	invalid: 1,
	invalidReason: 1,
})

export type PartInstanceFields = '_id' | 'segmentId' | 'rundownId' | 'orphaned' | 'reset' | 'part'
export const partInstanceFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<PartInstanceFields>>({
	_id: 1,
	segmentId: 1,
	rundownId: 1,
	orphaned: 1,
	reset: 1,
	// @ts-expect-error Deep not supported
	'part.title': 1,
})

export interface ContentCache {
	Rundowns: ReactiveCacheCollection<Pick<Rundown, RundownFields>>
	Segments: ReactiveCacheCollection<Pick<DBSegment, SegmentFields>>
	Parts: ReactiveCacheCollection<Pick<DBPart, PartFields>>
	DeletedPartInstances: ReactiveCacheCollection<Pick<PartInstance, PartInstanceFields>>
}

type ReactionWithCache = (cache: ContentCache) => void

export function createReactiveContentCache(
	reaction: ReactionWithCache,
	reactivityDebounce: number
): { cache: ContentCache; cancel: () => void } {
	let isCancelled = false
	const innerReaction = _.debounce(
		Meteor.bindEnvironment(() => {
			if (!isCancelled) reaction(cache)
		}),
		reactivityDebounce
	)
	const cancel = () => {
		isCancelled = true
		innerReaction.cancel()
	}

	const cache: ContentCache = {
		Rundowns: new ReactiveCacheCollection<Pick<Rundown, RundownFields>>('rundowns', innerReaction),
		Segments: new ReactiveCacheCollection<Pick<DBSegment, SegmentFields>>('segments', innerReaction),
		Parts: new ReactiveCacheCollection<Pick<DBPart, PartFields>>('parts', innerReaction),
		DeletedPartInstances: new ReactiveCacheCollection<Pick<PartInstance, PartInstanceFields>>(
			'deletedPartInstances',
			innerReaction
		),
	}

	innerReaction()

	return { cache, cancel }
}
