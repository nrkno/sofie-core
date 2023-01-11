import { Meteor } from 'meteor/meteor'
import { RundownId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Parts } from '../../../lib/collections/Parts'
import { Segments } from '../../../lib/collections/Segments'
import { logger } from '../../logging'
import {
	ContentCache,
	createReactiveContentCache,
	partFieldSpecifier,
	pieceFieldSpecifier,
	rundownFieldSpecifier,
	segmentFieldSpecifier,
	ShowStyleBaseFields,
	showStyleBaseFieldSpecifier,
	SourceLayersDoc,
} from './reactiveContentCache'
import { Pieces } from '../../../lib/collections/Pieces'
import { Rundowns } from '../../../lib/collections/Rundowns'
import { ShowStyleBase, ShowStyleBases } from '../../../lib/collections/ShowStyleBases'
import { equivalentArrays, waitForPromise } from '../../../lib/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ReactiveMongoObserverGroup, ReactiveMongoObserverGroupHandle } from '../lib/observerGroup'
import _ from 'underscore'

const REACTIVITY_DEBOUNCE = 20

type ChangedHandler = (cache: ContentCache) => () => void

function convertShowStyleBase(doc: Pick<ShowStyleBase, ShowStyleBaseFields>): Omit<SourceLayersDoc, '_id'> {
	return {
		sourceLayers: applyAndValidateOverrides(doc.sourceLayersWithOverrides).obj,
	}
}

export class RundownContentObserver {
	#observers: Meteor.LiveQueryHandle[] = []
	#cache: ContentCache
	#cancelCache: () => void
	#cleanup: () => void

	#showStyleBaseIds: ShowStyleBaseId[] = []
	#showStyleBaseIdObserver: ReactiveMongoObserverGroupHandle

	constructor(rundownIds: RundownId[], onChanged: ChangedHandler) {
		logger.silly(`Creating RundownContentObserver for rundowns "${rundownIds.join(',')}"`)
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
					ShowStyleBases.find(
						{
							// We can use the `this.#showStyleBaseIds` here, as this is restarted every time that property changes
							_id: { $in: this.#showStyleBaseIds },
						},
						{
							projection: showStyleBaseFieldSpecifier,
						}
					).observe({
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
					}),
				]
			})
		)

		// Subscribe to the database, and pipe any updates into the ReactiveCacheCollections
		this.#observers = [
			Rundowns.find(
				{
					_id: {
						$in: rundownIds,
					},
				},
				{
					projection: rundownFieldSpecifier,
				}
			).observe(
				cache.Rundowns.link(() => {
					// Check if the ShowStyleBaseIds needs updating
					this.updateShowStyleBaseIds()
				})
			),
			this.#showStyleBaseIdObserver,

			Segments.find(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				{
					projection: segmentFieldSpecifier,
				}
			).observe(cache.Segments.link()),
			Parts.find(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				{
					projection: partFieldSpecifier,
				}
			).observe(cache.Parts.link()),
			Pieces.find(
				{
					startRundownId: {
						$in: rundownIds,
					},
				},
				{
					projection: pieceFieldSpecifier,
				}
			).observe(cache.Pieces.link()),
		]
	}

	private updateShowStyleBaseIds = _.debounce(
		Meteor.bindEnvironment(() => {
			const newShowStyleBaseIds = this.#cache.Rundowns.find({}).map((rd) => rd.showStyleBaseId)

			if (!equivalentArrays(newShowStyleBaseIds, this.#showStyleBaseIds)) {
				// trigger the rundown group to restart
				this.#showStyleBaseIdObserver.restart()
			}
		}),
		REACTIVITY_DEBOUNCE
	)

	public get cache(): ContentCache {
		return this.#cache
	}

	public dispose = (): void => {
		this.#cancelCache()
		this.#observers.forEach((observer) => observer.stop())
		this.#cleanup()
	}
}
