import { Meteor } from 'meteor/meteor'
import { BucketId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../../logging'
import {
	bucketActionFieldSpecifier,
	bucketAdlibFieldSpecifier,
	BucketContentCache,
	ShowStyleBaseFields,
	showStyleBaseFieldSpecifier,
	SourceLayersDoc,
} from './bucketContentCache'
import { BucketAdLibActions, BucketAdLibs, ShowStyleBases } from '../../../collections'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { equivalentArrays, waitForPromise } from '../../../../lib/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ReactiveMongoObserverGroup, ReactiveMongoObserverGroupHandle } from '../../lib/observerGroup'
import _ from 'underscore'

const REACTIVITY_DEBOUNCE = 20

function convertShowStyleBase(doc: Pick<DBShowStyleBase, ShowStyleBaseFields>): Omit<SourceLayersDoc, '_id'> {
	return {
		blueprintId: doc.blueprintId,
		sourceLayers: applyAndValidateOverrides(doc.sourceLayersWithOverrides).obj,
	}
}

export class BucketContentObserver implements Meteor.LiveQueryHandle {
	#observers: Meteor.LiveQueryHandle[] = []
	#cache: BucketContentCache

	#showStyleBaseIds: ShowStyleBaseId[] = []
	#showStyleBaseIdObserver: ReactiveMongoObserverGroupHandle

	constructor(bucketId: BucketId, cache: BucketContentCache) {
		logger.silly(`Creating BucketContentObserver for "${bucketId}"`)
		this.#cache = cache

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
			BucketAdLibs.observeChanges(
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
			BucketAdLibActions.observeChanges(
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
		this.#observers.forEach((observer) => observer.stop())
	}
}
