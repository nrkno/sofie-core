import { Meteor } from 'meteor/meteor'
import { BucketId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../../logging'
import {
	bucketActionFieldSpecifier,
	bucketAdlibFieldSpecifier,
	BucketContentCache,
	createReactiveContentCache,
	ShowStyleBaseFields,
	showStyleBaseFieldSpecifier,
	SourceLayersDoc,
} from './bucketContentCache'
import { BucketAdLibActions, BucketAdLibs, ShowStyleBases } from '../../../collections'
import { ShowStyleBase } from '../../../../lib/collections/ShowStyleBases'
import { equivalentArrays, waitForPromise } from '../../../../lib/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ReactiveMongoObserverGroup, ReactiveMongoObserverGroupHandle } from '../../lib/observerGroup'
import _ from 'underscore'

const REACTIVITY_DEBOUNCE = 20

type ChangedHandler = (cache: BucketContentCache) => () => void

function convertShowStyleBase(doc: Pick<ShowStyleBase, ShowStyleBaseFields>): Omit<SourceLayersDoc, '_id'> {
	return {
		blueprintId: doc.blueprintId,
		sourceLayers: applyAndValidateOverrides(doc.sourceLayersWithOverrides).obj,
	}
}

export class BucketContentObserver implements Meteor.LiveQueryHandle {
	#observers: Meteor.LiveQueryHandle[] = []
	#cache: BucketContentCache
	#cancelCache: () => void
	#cleanup: () => void

	#showStyleBaseIds: ShowStyleBaseId[] = []
	#showStyleBaseIdObserver: ReactiveMongoObserverGroupHandle

	constructor(bucketId: BucketId, onChanged: ChangedHandler) {
		logger.silly(`Creating BucketContentObserver for "${bucketId}"`)
		const { cache, cancel: cancelCache } = createReactiveContentCache((cache) => {
			this.#cleanup = onChanged(cache)
		}, REACTIVITY_DEBOUNCE)

		this.#cache = cache
		this.#cancelCache = cancelCache

		// Run the ShowStyleBase query in a ReactiveMongoObserverGroup, so that it can be restarted whenever
		this.#showStyleBaseIdObserver = waitForPromise(
			ReactiveMongoObserverGroup(async () => {
				// Clear already cached data
				cache.ShowStyleSourceLayers.remove({})

				return [
					ShowStyleBases.observe(
						{
							// We can use the `this.#showStyleBaseIds` here, as this is restarted every time that property changes
							_id: { $in: this.#showStyleBaseIds },
						},
						{
							added: (doc) => {
								const newDoc = convertShowStyleBase(doc)
								cache.ShowStyleSourceLayers.upsert(doc._id, { $set: newDoc as Partial<Document> })
							},
							changed: (doc) => {
								const newDoc = convertShowStyleBase(doc)
								cache.ShowStyleSourceLayers.upsert(doc._id, { $set: newDoc as Partial<Document> })
							},
							removed: (doc) => {
								cache.ShowStyleSourceLayers.remove(doc._id)
							},
						},
						{
							projection: showStyleBaseFieldSpecifier,
						}
					),
				]
			})
		)

		// Subscribe to the database, and pipe any updates into the ReactiveCacheCollections
		this.#observers = [
			BucketAdLibs.observe(
				{
					bucketId: bucketId,
				},
				cache.BucketAdLibs.link(() => {
					// Check if the ShowStyleBaseIds needs updating
					// TODO - is this over-eager?
					this.updateShowStyleBaseIds()
				}),
				{
					projection: bucketAdlibFieldSpecifier,
				}
			),
			BucketAdLibActions.observe(
				{
					bucketId: bucketId,
				},
				cache.BucketAdLibActions.link(() => {
					// Check if the ShowStyleBaseIds needs updating
					// TODO - is this over-eager?
					this.updateShowStyleBaseIds()
				}),
				{
					projection: bucketActionFieldSpecifier,
				}
			),

			this.#showStyleBaseIdObserver,
		]
	}

	private updateShowStyleBaseIds = _.debounce(
		Meteor.bindEnvironment(() => {
			const newShowStyleBaseIdsSet = new Set<ShowStyleBaseId>()
			this.#cache.BucketAdLibs.find({}).forEach((adlib) => newShowStyleBaseIdsSet.add(adlib.showStyleBaseId))
			this.#cache.BucketAdLibActions.find({}).forEach((action) =>
				newShowStyleBaseIdsSet.add(action.showStyleBaseId)
			)

			const newShowStyleBaseIds = Array.from(newShowStyleBaseIdsSet)

			if (!equivalentArrays(newShowStyleBaseIds, this.#showStyleBaseIds)) {
				this.#showStyleBaseIds = newShowStyleBaseIds
				// trigger the rundown group to restart
				this.#showStyleBaseIdObserver.restart()
			}
		}),
		REACTIVITY_DEBOUNCE
	)

	public get cache(): BucketContentCache {
		return this.#cache
	}

	public stop = (): void => {
		this.#cancelCache()
		this.#observers.forEach((observer) => observer.stop())
		this.#cleanup()
	}
}
