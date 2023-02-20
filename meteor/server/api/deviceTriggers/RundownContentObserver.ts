import { Meteor } from 'meteor/meteor'
import {
	RundownId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
	ShowStyleBaseId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	PartInstances,
	Parts,
	RundownBaselineAdLibActions,
	RundownBaselineAdLibPieces,
	RundownPlaylists,
	AdLibActions,
	AdLibPieces,
	Segments,
	ShowStyleBases,
	TriggeredActions,
} from '../../collections'
import { logger } from '../../logging'
import {
	adLibActionFieldSpecifier,
	adLibPieceFieldSpecifier,
	ContentCache,
	createReactiveContentCache,
	partFieldSpecifier,
	partInstanceFieldSpecifier,
	rundownPlaylistFieldSpecifier,
	segmentFieldSpecifier,
} from './reactiveContentCache'

const REACTIVITY_DEBOUNCE = 20

type ChangedHandler = (cache: ContentCache) => () => void

export class RundownContentObserver {
	#observers: Meteor.LiveQueryHandle[] = []
	#cache: ContentCache
	#cancelCache: () => void
	#cleanup: () => void

	constructor(
		rundownPlaylistId: RundownPlaylistId,
		showStyleBaseId: ShowStyleBaseId,
		rundownIds: RundownId[],
		activationId: RundownPlaylistActivationId,
		onChanged: ChangedHandler
	) {
		logger.silly(`Creating RundownContentObserver for playlist "${rundownPlaylistId}" activation "${activationId}"`)
		const { cache, cancel: cancelCache } = createReactiveContentCache(() => {
			this.#cleanup = onChanged(cache)
		}, REACTIVITY_DEBOUNCE)

		this.#cache = cache
		this.#cancelCache = cancelCache

		this.#observers = [
			RundownPlaylists.find(rundownPlaylistId, {
				projection: rundownPlaylistFieldSpecifier,
			}).observeChanges(cache.RundownPlaylists.link()),
			ShowStyleBases.find(showStyleBaseId).observeChanges(cache.ShowStyleBases.link()),
			TriggeredActions.find({
				showStyleBaseId: {
					$in: [showStyleBaseId, null],
				},
			}).observeChanges(cache.TriggeredActions.link()),
			Segments.find(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				{
					projection: segmentFieldSpecifier,
				}
			).observeChanges(cache.Segments.link()),
			Parts.find(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				{
					projection: partFieldSpecifier,
				}
			).observeChanges(cache.Parts.link()),
			PartInstances.find(
				{
					playlistActivationId: activationId,
					reset: {
						$ne: true,
					},
				},
				{
					projection: partInstanceFieldSpecifier,
				}
			).observeChanges(cache.PartInstances.link()),
			RundownBaselineAdLibActions.find(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				{
					projection: adLibActionFieldSpecifier,
				}
			).observeChanges(cache.RundownBaselineAdLibActions.link()),
			RundownBaselineAdLibPieces.find(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				{
					projection: adLibPieceFieldSpecifier,
				}
			).observeChanges(cache.RundownBaselineAdLibPieces.link()),
			AdLibActions.find(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				{
					projection: adLibActionFieldSpecifier,
				}
			).observeChanges(cache.AdLibActions.link()),
			AdLibPieces.find(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				{
					projection: adLibPieceFieldSpecifier,
				}
			).observeChanges(cache.AdLibPieces.link()),
		]
	}

	public get cache(): ContentCache {
		return this.#cache
	}

	public stop = (): void => {
		this.#cancelCache()
		this.#observers.forEach((observer) => observer.stop())
		this.#cleanup()
	}
}
