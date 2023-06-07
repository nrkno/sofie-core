import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import { ReactiveCacheCollection } from '../../lib/ReactiveCacheCollection'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { IncludeAllMongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export type SourceLayersDocId = ProtectedString<'SourceLayersDocId'>
export interface SourceLayersDoc {
	_id: SourceLayersDocId
	blueprintId: BlueprintId
	sourceLayers: SourceLayers
}

export type BucketAdLibFields =
	| '_id'
	| 'bucketId'
	| 'studioId'
	| 'showStyleBaseId'
	| 'name'
	| 'sourceLayerId'
	| 'content'
	| 'expectedPackages'
export const bucketAdlibFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<BucketAdLibFields>>({
	_id: 1,
	bucketId: 1,
	studioId: 1,
	showStyleBaseId: 1,
	name: 1,
	sourceLayerId: 1,
	content: 1,
	expectedPackages: 1,
})

export type BucketActionFields = '_id' | 'bucketId' | 'studioId' | 'showStyleBaseId' | 'display' | 'expectedPackages'
export const bucketActionFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<BucketActionFields>>({
	_id: 1,
	bucketId: 1,
	studioId: 1,
	showStyleBaseId: 1,
	display: 1,
	expectedPackages: 1,
})

export type ShowStyleBaseFields = '_id' | 'blueprintId' | 'sourceLayersWithOverrides'
export const showStyleBaseFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<ShowStyleBaseFields>>({
	_id: 1,
	blueprintId: 1,
	sourceLayersWithOverrides: 1,
})

export interface BucketContentCache {
	BucketAdLibs: ReactiveCacheCollection<Pick<BucketAdLib, BucketAdLibFields>>
	BucketAdLibActions: ReactiveCacheCollection<Pick<BucketAdLibAction, BucketActionFields>>
	ShowStyleSourceLayers: ReactiveCacheCollection<SourceLayersDoc>
}

type ReactionWithCache = (cache: BucketContentCache) => void

export function createReactiveContentCache(
	reaction: ReactionWithCache,
	reactivityDebounce: number
): { cache: BucketContentCache; cancel: () => void } {
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

	const cache: BucketContentCache = {
		BucketAdLibs: new ReactiveCacheCollection<Pick<BucketAdLib, BucketAdLibFields>>('bucketAdlibs', innerReaction),
		BucketAdLibActions: new ReactiveCacheCollection<Pick<BucketAdLibAction, BucketActionFields>>(
			'bucketAdlibActions',
			innerReaction
		),
		ShowStyleSourceLayers: new ReactiveCacheCollection<SourceLayersDoc>('sourceLayers', innerReaction),
	}

	innerReaction()

	return { cache, cancel }
}
