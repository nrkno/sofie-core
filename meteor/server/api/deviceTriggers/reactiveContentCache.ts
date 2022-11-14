import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBTriggeredActions } from '../../../lib/collections/TriggeredActions'
import { ReactiveCacheCollection } from './ReactiveCacheCollection'

export interface ContentCache {
	Segments: ReactiveCacheCollection<DBSegment>
	PartInstances: ReactiveCacheCollection<Pick<DBPartInstance, '_id' | 'part'>>
	Parts: ReactiveCacheCollection<DBPart>
	AdLibPieces: ReactiveCacheCollection<AdLibPiece>
	AdLibActions: ReactiveCacheCollection<AdLibAction>
	RundownBaselineAdLibPieces: ReactiveCacheCollection<RundownBaselineAdLibItem>
	RundownBaselineAdLibActions: ReactiveCacheCollection<RundownBaselineAdLibAction>
	ShowStyleBases: ReactiveCacheCollection<DBShowStyleBase>
	TriggeredActions: ReactiveCacheCollection<DBTriggeredActions>
	RundownPlaylists: ReactiveCacheCollection<
		Pick<DBRundownPlaylist, '_id' | 'name' | 'activationId' | 'currentPartInstanceId' | 'nextPartInstanceId'>
	>
}

type ReactionWithCache = (cache: ContentCache) => void

export function createReactiveContentCache(
	reaction: ReactionWithCache,
	reactivityDebounce: number
): { cache: ContentCache; cancel: () => void } {
	let isCancelled = false
	const innerReaction = _.debounce(
		Meteor.bindEnvironment(() => {
			if (isCancelled) return
			reaction(cache)
		}),
		reactivityDebounce
	)
	const cancel = () => {
		isCancelled = true
		innerReaction?.cancel()
	}

	const cache: ContentCache = {
		Segments: new ReactiveCacheCollection<DBSegment>(innerReaction),
		PartInstances: new ReactiveCacheCollection<Pick<DBPartInstance, '_id' | 'part'>>(innerReaction),
		Parts: new ReactiveCacheCollection<DBPart>(innerReaction),
		AdLibPieces: new ReactiveCacheCollection<AdLibPiece>(innerReaction),
		AdLibActions: new ReactiveCacheCollection<AdLibAction>(innerReaction),
		RundownBaselineAdLibPieces: new ReactiveCacheCollection<RundownBaselineAdLibItem>(innerReaction),
		RundownBaselineAdLibActions: new ReactiveCacheCollection<RundownBaselineAdLibAction>(innerReaction),
		ShowStyleBases: new ReactiveCacheCollection<DBShowStyleBase>(innerReaction),
		TriggeredActions: new ReactiveCacheCollection<DBTriggeredActions>(innerReaction),
		RundownPlaylists: new ReactiveCacheCollection<
			Pick<DBRundownPlaylist, '_id' | 'name' | 'activationId' | 'currentPartInstanceId' | 'nextPartInstanceId'>
		>(innerReaction),
	}

	return { cache, cancel }
}
