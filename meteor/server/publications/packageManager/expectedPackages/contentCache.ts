import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import { ReactiveCacheCollection } from '../../lib/ReactiveCacheCollection'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { ExpectedPackageDB } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'

export type RundownPlaylistCompact = Pick<
	DBRundownPlaylist,
	'_id' | 'activationId' | 'currentPartInfo' | 'nextPartInfo'
>
export const rundownPlaylistFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<RundownPlaylistCompact>>({
	_id: 1,
	activationId: 1,
	currentPartInfo: 1, // So that it invalidates when the current changes
	nextPartInfo: 1, // So that it invalidates when the next changes
})

export type PieceInstanceCompact = Pick<PieceInstance, '_id' | 'rundownId'> & {
	piece: Pick<PieceInstancePiece, 'expectedPackages'>
}

export const pieceInstanceFieldsSpecifier = literal<MongoFieldSpecifierOnesStrict<PieceInstanceCompact>>({
	_id: 1,
	rundownId: 1,
	piece: {
		expectedPackages: 1,
	},
})

export interface ExpectedPackagesContentCache {
	ExpectedPackages: ReactiveCacheCollection<ExpectedPackageDB>
	RundownPlaylists: ReactiveCacheCollection<RundownPlaylistCompact>
	PieceInstances: ReactiveCacheCollection<PieceInstanceCompact>
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
		RundownPlaylists: new ReactiveCacheCollection<RundownPlaylistCompact>('rundownPlaylists', innerReaction),
		PieceInstances: new ReactiveCacheCollection<PieceInstanceCompact>('pieceInstances', innerReaction),
	}

	innerReaction()

	return { cache, cancel }
}
