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

export class RundownContentObserver {
	#observers: Meteor.LiveQueryHandle[] = []
	#cache: ContentCache

	#showStyleBaseIds: ShowStyleBaseId[] = []
	#showStyleBaseIdObserver: ReactiveMongoObserverGroupHandle

	constructor(rundownIds: RundownId[], cache: ContentCache) {
		logger.silly(`Creating RundownContentObserver for rundowns "${rundownIds.join(',')}"`)
		this.#cache = cache

		// Run the ShowStyleBase query in a ReactiveMongoObserverGroup, so that it can be restarted whenever
		this.#showStyleBaseIdObserver = waitForPromise(
			ReactiveMongoObserverGroup(async () => {
				// Clear already cached data
				cache.ShowStyleSourceLayers.remove({})

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
			Rundowns.observeChanges(
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
			Pieces.observeChanges(
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
			PartInstances.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
					reset: { $ne: true },
				},
				cache.PartInstances.link(),
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
				cache.PieceInstances.link(),
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
				cache.AdLibPieces.link(),
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
			RundownBaselineAdLibPieces.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				cache.BaselineAdLibPieces.link(),
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
				cache.BaselineAdLibActions.link(),
				{
					projection: adLibActionFieldSpecifier,
				}
			),
		]
	}

	private updateShowStyleBaseIds = _.debounce(
		Meteor.bindEnvironment(() => {
			const newShowStyleBaseIds = this.#cache.Rundowns.find({}).map((rd) => rd.showStyleBaseId)

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
