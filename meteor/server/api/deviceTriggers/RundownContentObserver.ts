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
	#cleanup: () => void = () => {
		throw new Error('RundownContentObserver.#cleanup has not been set!')
	}
	#disposed = false

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
			if (this.#disposed) this.#cleanup()
		}, REACTIVITY_DEBOUNCE)

		this.#cache = cache
		this.#cancelCache = cancelCache

		this.#observers = [
			RundownPlaylists.observeChanges(rundownPlaylistId, cache.RundownPlaylists.link(), {
				projection: rundownPlaylistFieldSpecifier,
			}),
			ShowStyleBases.observeChanges(showStyleBaseId, cache.ShowStyleBases.link()),
			TriggeredActions.observeChanges(
				{
					showStyleBaseId: {
						$in: [showStyleBaseId, null],
					},
				},
				cache.TriggeredActions.link()
			),
			Segments.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				cache.Segments.link(),
				{
					projection: segmentFieldSpecifier,
				}
			),
			Parts.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				cache.Parts.link(),
				{
					projection: partFieldSpecifier,
				}
			),
			PartInstances.observeChanges(
				{
					playlistActivationId: activationId,
					reset: {
						$ne: true,
					},
				},
				cache.PartInstances.link(),
				{
					projection: partInstanceFieldSpecifier,
				}
			),
			RundownBaselineAdLibActions.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				cache.RundownBaselineAdLibActions.link(),
				{
					projection: adLibActionFieldSpecifier,
				}
			),
			RundownBaselineAdLibPieces.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				cache.RundownBaselineAdLibPieces.link(),
				{
					projection: adLibPieceFieldSpecifier,
				}
			),
			AdLibActions.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				cache.AdLibActions.link(),
				{
					projection: adLibActionFieldSpecifier,
				}
			),
			AdLibPieces.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				cache.AdLibPieces.link(),
				{
					projection: adLibPieceFieldSpecifier,
				}
			),
		]
	}

	public get cache(): ContentCache {
		return this.#cache
	}

	public stop = (): void => {
		this.#disposed = true
		this.#cancelCache()
		this.#observers.forEach((observer) => observer.stop())
		this.#cleanup?.()
	}
}
