import { Meteor } from 'meteor/meteor'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../logging'
import {
	ContentCache,
	partFieldSpecifier,
	partInstanceFieldSpecifier,
	rundownFieldSpecifier,
	segmentFieldSpecifier,
} from './reactiveContentCache'
import { PartInstances, Parts, Rundowns, Segments } from '../../collections'

export class RundownContentObserver {
	#observers: Meteor.LiveQueryHandle[] = []
	#cache: ContentCache

	constructor(rundownIds: RundownId[], cache: ContentCache) {
		logger.silly(`Creating RundownContentObserver for rundowns "${rundownIds.join(',')}"`)
		this.#cache = cache

		this.#observers = [
			Rundowns.observeChanges(
				{
					_id: {
						$in: rundownIds,
					},
				},
				cache.Rundowns.link(),
				{
					projection: rundownFieldSpecifier,
				}
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
				{ rundownId: { $in: rundownIds }, reset: { $ne: true }, orphaned: 'deleted' },
				cache.DeletedPartInstances.link(),
				{ fields: partInstanceFieldSpecifier }
			),
		]
	}

	public get cache(): ContentCache {
		return this.#cache
	}

	public dispose = (): void => {
		this.#observers.forEach((observer) => observer.stop())
	}
}
