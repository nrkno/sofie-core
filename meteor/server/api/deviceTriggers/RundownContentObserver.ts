import { Meteor } from 'meteor/meteor'
import { RundownId, RundownPlaylistId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
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
	#cleanup: (() => void) | undefined
	#disposed = false

	constructor(
		rundownPlaylistId: RundownPlaylistId,
		showStyleBaseId: ShowStyleBaseId,
		rundownIds: RundownId[],
		onChanged: ChangedHandler
	) {
		logger.silly(`Creating RundownContentObserver for playlist "${rundownPlaylistId}"`)
		const { cache, cancel: cancelCache } = createReactiveContentCache(() => {
			this.#cleanup = onChanged(cache)
			if (this.#disposed) this.#cleanup()
		}, REACTIVITY_DEBOUNCE)

		this.#cache = cache
		this.#cancelCache = cancelCache

		this.#observers = [
			RundownPlaylists.observe(rundownPlaylistId, cache.RundownPlaylists.link(), {
				projection: rundownPlaylistFieldSpecifier,
			}),
			ShowStyleBases.observe(showStyleBaseId, cache.ShowStyleBases.link()),
			TriggeredActions.observe(
				{
					showStyleBaseId: {
						$in: [showStyleBaseId, null],
					},
				},
				cache.TriggeredActions.link()
			),
			Segments.observe(
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
			Parts.observe(
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
			PartInstances.observe(
				{
					rundownId: {
						$in: rundownIds,
					},
					reset: {
						$ne: true,
					},
				},
				cache.PartInstances.link(),
				{
					projection: partInstanceFieldSpecifier,
				}
			),
			RundownBaselineAdLibActions.observe(
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
			RundownBaselineAdLibPieces.observe(
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
			AdLibActions.observe(
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
			AdLibPieces.observe(
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
