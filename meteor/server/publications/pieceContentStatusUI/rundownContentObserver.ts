import { Meteor } from 'meteor/meteor'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
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
import { ReactiveMongoObserverGroup } from '../../lib/customPublication'
import { waitForPromise } from '../../../lib/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

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

	constructor(rundownIds: RundownId[], onChanged: ChangedHandler) {
		logger.silly(`Creating RundownContentObserver for rundowns "${rundownIds.join(',')}"`)
		const { cache, cancel: cancelCache } = createReactiveContentCache(() => {
			this.#cleanup = onChanged(cache)
		}, REACTIVITY_DEBOUNCE)

		this.#cache = cache
		this.#cancelCache = cancelCache

		const rundownGroup = waitForPromise(
			ReactiveMongoObserverGroup(async () => {
				// We can use the `cache.Rundowns` here, as this is restarted every time that collection changes
				const showStyleBaseIds = cache.Rundowns.find({})
					.fetch()
					.map((rd) => rd.showStyleBaseId)

				// Clear already cached data
				cache.ShowStyleSourceLayers.remove({})

				return [
					ShowStyleBases.find(
						{
							_id: { $in: showStyleBaseIds },
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
					// trigger the rundown group to restart
					waitForPromise(rundownGroup.restart())
				})
			),
			rundownGroup,

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

	public get cache(): ContentCache {
		return this.#cache
	}

	public dispose = (): void => {
		this.#cancelCache()
		this.#observers.forEach((observer) => observer.stop())
		this.#cleanup()
	}
}
