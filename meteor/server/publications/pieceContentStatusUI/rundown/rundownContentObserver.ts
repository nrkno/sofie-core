import { Meteor } from 'meteor/meteor'
import { RundownId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../../logging'
import {
	adLibActionFieldSpecifier,
	adLibPieceFieldSpecifier,
	ContentCache,
	partFieldSpecifier,
	partInstanceFieldSpecifier,
	pieceFieldSpecifier,
	pieceInstanceFieldSpecifier,
	rundownFieldSpecifier,
	segmentFieldSpecifier,
	ShowStyleBaseFields,
	showStyleBaseFieldSpecifier,
	SourceLayersDoc,
} from './reactiveContentCache'
import {
	AdLibActions,
	AdLibPieces,
	PartInstances,
	Parts,
	PieceInstances,
	Pieces,
	RundownBaselineAdLibActions,
	RundownBaselineAdLibPieces,
	Rundowns,
	Segments,
	ShowStyleBases,
} from '../../../collections'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ReactiveMongoObserverGroup, ReactiveMongoObserverGroupHandle } from '../../lib/observerGroup'
import _ from 'underscore'
import { equivalentArrays } from '@sofie-automation/shared-lib/dist/lib/lib'
import { waitForAllObserversReady } from '../../lib/lib'

const REACTIVITY_DEBOUNCE = 20

function convertShowStyleBase(doc: Pick<DBShowStyleBase, ShowStyleBaseFields>): Omit<SourceLayersDoc, '_id'> {
	return {
		blueprintId: doc.blueprintId,
		sourceLayers: applyAndValidateOverrides(doc.sourceLayersWithOverrides).obj,
	}
}

export class RundownContentObserver {
	#observers: Meteor.LiveQueryHandle[] = []
	readonly #cache: ContentCache

	#showStyleBaseIds: ShowStyleBaseId[] = []
	#showStyleBaseIdObserver!: ReactiveMongoObserverGroupHandle

	private constructor(cache: ContentCache) {
		this.#cache = cache
	}

	static async create(rundownIds: RundownId[], cache: ContentCache): Promise<RundownContentObserver> {
		logger.silly(`Creating RundownContentObserver for rundowns "${rundownIds.join(',')}"`)

		const observer = new RundownContentObserver(cache)

		await observer.initShowStyleBaseIdObserver()

		// This takes ownership of the #showStyleBaseIdObserver, and will stop it if this throws
		await observer.initContentObservers(rundownIds)

		return observer
	}

	private async initShowStyleBaseIdObserver() {
		// Run the ShowStyleBase query in a ReactiveMongoObserverGroup, so that it can be restarted whenever
		this.#showStyleBaseIdObserver = await ReactiveMongoObserverGroup(async () => {
			// Clear already cached data
			this.#cache.ShowStyleSourceLayers.remove({})

			logger.silly(`optimized observer restarting ${this.#showStyleBaseIds}`)

			return [
				ShowStyleBases.observe(
					{
						// We can use the `this.#showStyleBaseIds` here, as this is restarted every time that property changes
						_id: { $in: this.#showStyleBaseIds },
					},
					{
						added: (doc) => {
							const newDoc = convertShowStyleBase(doc)
							this.#cache.ShowStyleSourceLayers.upsert(doc._id, { $set: newDoc as Partial<Document> })
						},
						changed: (doc) => {
							const newDoc = convertShowStyleBase(doc)
							this.#cache.ShowStyleSourceLayers.upsert(doc._id, { $set: newDoc as Partial<Document> })
						},
						removed: (doc) => {
							this.#cache.ShowStyleSourceLayers.remove(doc._id)
						},
					},
					{
						projection: showStyleBaseFieldSpecifier,
					}
				),
			]
		})
	}

	private async initContentObservers(rundownIds: RundownId[]) {
		// Subscribe to the database, and pipe any updates into the ReactiveCacheCollections
		this.#observers = await waitForAllObserversReady([
			Rundowns.observeChanges(
				{
					_id: {
						$in: rundownIds,
					},
				},
				this.#cache.Rundowns.link(() => {
					// Check if the ShowStyleBaseIds needs updating
					this.updateShowStyleBaseIds()
				}),
				{
					projection: rundownFieldSpecifier,
				}
			),
			this.#showStyleBaseIdObserver,

			Segments.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				this.#cache.Segments.link(),
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
				this.#cache.Parts.link(),
				{
					projection: partFieldSpecifier,
				}
			),
			Pieces.observeChanges(
				{
					startRundownId: {
						$in: rundownIds,
					},
				},
				this.#cache.Pieces.link(),
				{
					projection: pieceFieldSpecifier,
				}
			),
			PartInstances.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
					reset: { $ne: true },
				},
				this.#cache.PartInstances.link(),
				{
					projection: partInstanceFieldSpecifier,
				}
			),
			PieceInstances.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
					reset: { $ne: true },
				},
				this.#cache.PieceInstances.link(),
				{
					projection: pieceInstanceFieldSpecifier,
				}
			),
			AdLibPieces.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				this.#cache.AdLibPieces.link(),
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
				this.#cache.AdLibActions.link(),
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
				this.#cache.BaselineAdLibPieces.link(),
				{
					projection: adLibPieceFieldSpecifier,
				}
			),
			RundownBaselineAdLibActions.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				this.#cache.BaselineAdLibActions.link(),
				{
					projection: adLibActionFieldSpecifier,
				}
			),
		])
	}

	private updateShowStyleBaseIds = _.debounce(
		Meteor.bindEnvironment(() => {
			const newShowStyleBaseIds = _.uniq(this.#cache.Rundowns.find({}).map((rd) => rd.showStyleBaseId))

			if (!equivalentArrays(newShowStyleBaseIds, this.#showStyleBaseIds)) {
				logger.silly(
					`optimized observer changed ids ${JSON.stringify(newShowStyleBaseIds)} ${this.#showStyleBaseIds}`
				)
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
		this.#observers.forEach((observer) => observer.stop())
	}
}
