import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import { ReactiveCacheCollection } from '../../lib/ReactiveCacheCollection'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { IncludeAllMongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { ExpectedPackageDB } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'

export type RundownPlaylistFields = '_id' | 'activationId' | 'currentPartInfo' | 'nextPartInfo'
export const rundownPlaylistFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<RundownPlaylistFields>>({
	// It should be enough to watch these fields for changes
	_id: 1,
	activationId: 1,
	currentPartInfo: 1, // So that it invalidates when the current changes
	nextPartInfo: 1, // So that it invalidates when the next changes
})

export type PieceInstanceFields = '_id' | 'rundownId' | 'piece'
export const pieceInstanceFieldsSpecifier = literal<IncludeAllMongoFieldSpecifier<PieceInstanceFields>>({
	_id: 1,
	rundownId: 1,
	piece: 1, // TODO - more granular?
})

export interface ExpectedPackagesContentCache {
	ExpectedPackages: ReactiveCacheCollection<ExpectedPackageDB>
	RundownPlaylists: ReactiveCacheCollection<Pick<DBRundownPlaylist, RundownPlaylistFields>>
	PieceInstances: ReactiveCacheCollection<Pick<PieceInstance, PieceInstanceFields>>
}

type ReactionWithCache = (cache: ExpectedPackagesContentCache) => void

export function createReactiveContentCache(
	reaction: ReactionWithCache,
	reactivityDebounce: number
): { cache: ExpectedPackagesContentCache; cancel: () => void } {
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

	const cache: ExpectedPackagesContentCache = {
		ExpectedPackages: new ReactiveCacheCollection<ExpectedPackageDB>('expectedPackages', innerReaction),
		RundownPlaylists: new ReactiveCacheCollection<Pick<DBRundownPlaylist, RundownPlaylistFields>>(
			'rundownPlaylists',
			innerReaction
		),
		PieceInstances: new ReactiveCacheCollection<Pick<PieceInstance, PieceInstanceFields>>(
			'pieceInstances',
			innerReaction
		),
	}

	innerReaction()

	return { cache, cancel }
}
