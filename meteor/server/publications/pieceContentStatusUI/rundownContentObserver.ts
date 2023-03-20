import { Meteor } from 'meteor/meteor'
import { RundownId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
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
import { Parts, Pieces, Rundowns, Segments, ShowStyleBases } from '../../collections'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
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
			Rundowns.observe(
				{
					_id: {
						$in: rundownIds,
					},
				},
				cache.Rundowns.link(() => {
					// Check if the ShowStyleBaseIds needs updating
					this.updateShowStyleBaseIds()
				}),
				{
					projection: rundownFieldSpecifier,
				}
			),
			this.#showStyleBaseIdObserver,

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
			Pieces.observe(
				{
					startRundownId: {
						$in: rundownIds,
					},
				},
				cache.Pieces.link(),
				{
					projection: pieceFieldSpecifier,
				}
			),
		]
	}

	private updateShowStyleBaseIds = _.debounce(
		Meteor.bindEnvironment(() => {
			const newShowStyleBaseIds = this.#cache.Rundowns.find({}).map((rd) => rd.showStyleBaseId)

			if (!equivalentArrays(newShowStyleBaseIds, this.#showStyleBaseIds)) {
				this.#showStyleBaseIds = newShowStyleBaseIds
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
