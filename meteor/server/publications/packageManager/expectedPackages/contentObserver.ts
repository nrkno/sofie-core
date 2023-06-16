import { Meteor } from 'meteor/meteor'
import { PartInstanceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../../logging'
import {
	ExpectedPackagesContentCache,
	createReactiveContentCache,
	rundownPlaylistFieldSpecifier,
	pieceInstanceFieldsSpecifier,
} from './contentCache'
import { ExpectedPackages, PieceInstances, RundownPlaylists } from '../../../collections'
import { equivalentArrays, waitForPromise } from '../../../../lib/lib'
import { ReactiveMongoObserverGroup, ReactiveMongoObserverGroupHandle } from '../../lib/observerGroup'
import _ from 'underscore'

const REACTIVITY_DEBOUNCE = 20

type ChangedHandler = (cache: ExpectedPackagesContentCache) => () => void

export class ExpectedPackagesContentObserver implements Meteor.LiveQueryHandle {
	#observers: Meteor.LiveQueryHandle[] = []
	#cache: ExpectedPackagesContentCache
	#cancelCache: () => void
	#cleanup: () => void

	#partInstanceIds: PartInstanceId[] = []
	#partInstanceIdObserver: ReactiveMongoObserverGroupHandle

	constructor(studioId: StudioId, onChanged: ChangedHandler) {
		logger.silly(`Creating ExpectedPackagesContentObserver for "${studioId}"`)
		const { cache, cancel: cancelCache } = createReactiveContentCache((cache) => {
			this.#cleanup = onChanged(cache)
		}, REACTIVITY_DEBOUNCE)

		this.#cache = cache
		this.#cancelCache = cancelCache

		// Run the ShowStyleBase query in a ReactiveMongoObserverGroup, so that it can be restarted whenever
		this.#partInstanceIdObserver = waitForPromise(
			ReactiveMongoObserverGroup(async () => {
				// Clear already cached data
				cache.PieceInstances.remove({})

				return [
					PieceInstances.observe(
						{
							// We can use the `this.#partInstanceIds` here, as this is restarted every time that property changes
							partInstanceId: { $in: this.#partInstanceIds },
						},
						cache.PieceInstances.link(),
						{
							projection: pieceInstanceFieldsSpecifier,
						}
					),
				]
			})
		)

		// Subscribe to the database, and pipe any updates into the ReactiveCacheCollections
		this.#observers = [
			ExpectedPackages.observe(
				{
					studioId: studioId,
				},
				cache.ExpectedPackages.link()
			),

			RundownPlaylists.observe(
				{
					studioId: studioId,
				},
				cache.RundownPlaylists.link(() => {
					this.updatePartInstanceIds()
				}),
				{
					fields: rundownPlaylistFieldSpecifier,
				}
			),

			this.#partInstanceIdObserver,
		]
	}

	private updatePartInstanceIds = _.debounce(
		Meteor.bindEnvironment(() => {
			const newPartInstanceIdsSet = new Set<PartInstanceId>()

			this.#cache.RundownPlaylists.find({}).forEach((playlist) => {
				if (playlist.activationId) {
					if (playlist.nextPartInfo) {
						newPartInstanceIdsSet.add(playlist.nextPartInfo.partInstanceId)
					}
					if (playlist.currentPartInfo) {
						newPartInstanceIdsSet.add(playlist.currentPartInfo.partInstanceId)
					}
				}
			})

			const newPartInstanceIds = Array.from(newPartInstanceIdsSet)

			if (!equivalentArrays(newPartInstanceIds, this.#partInstanceIds)) {
				this.#partInstanceIds = newPartInstanceIds
				// trigger the rundown group to restart
				this.#partInstanceIdObserver.restart()
			}
		}),
		REACTIVITY_DEBOUNCE
	)

	public get cache(): ExpectedPackagesContentCache {
		return this.#cache
	}

	public stop = (): void => {
		this.#cancelCache()
		this.#observers.forEach((observer) => observer.stop())
		this.#cleanup()
	}
}
