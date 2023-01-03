import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { ReactiveCacheCollection } from '../lib/ReactiveCacheCollection'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { IncludeAllMongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'

export type SourceLayersDocId = ProtectedString<'SourceLayersDocId'>
export interface SourceLayersDoc {
	_id: SourceLayersDocId
	sourceLayers: SourceLayers
}

export type SegmentFields = '_id' | '_rank' | 'name'
export const segmentFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<SegmentFields>>({
	_id: 1,
	_rank: 1,
	name: 1,
})

export type PartFields = '_id' | '_rank' | 'segmentId' | 'rundownId'
export const partFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<PartFields>>({
	_id: 1,
	_rank: 1,
	segmentId: 1,
	rundownId: 1,
})

export type PieceFields =
	| '_id'
	| 'startPartId'
	| 'startRundownId'
	| 'name'
	| 'sourceLayerId'
	| 'content'
	| 'expectedPackages'
export const pieceFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<PieceFields>>({
	_id: 1,
	startPartId: 1,
	startRundownId: 1,
	name: 1,
	sourceLayerId: 1,
	content: 1,
	expectedPackages: 1,
})

export type RundownFields = '_id' | 'showStyleBaseId'
export const rundownFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<RundownFields>>({
	_id: 1,
	showStyleBaseId: 1,
})

export type ShowStyleBaseFields = '_id' | 'sourceLayersWithOverrides'
export const showStyleBaseFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<ShowStyleBaseFields>>({
	_id: 1,
	sourceLayersWithOverrides: 1,
})

export interface ContentCache {
	Rundowns: ReactiveCacheCollection<Pick<Rundown, RundownFields>>
	Segments: ReactiveCacheCollection<Pick<DBSegment, SegmentFields>>
	Parts: ReactiveCacheCollection<Pick<DBPart, PartFields>>
	Pieces: ReactiveCacheCollection<Pick<Piece, PieceFields>>
	ShowStyleSourceLayers: ReactiveCacheCollection<SourceLayersDoc>
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
		Pieces: new ReactiveCacheCollection<Pick<Piece, PieceFields>>('pieces', innerReaction),
		ShowStyleSourceLayers: new ReactiveCacheCollection<SourceLayersDoc>('sourceLayers', innerReaction),
	}

	innerReaction()

	return { cache, cancel }
}
