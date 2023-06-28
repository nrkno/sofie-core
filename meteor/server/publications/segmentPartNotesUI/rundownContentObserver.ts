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
			Rundowns.find(
				{
					_id: {
						$in: rundownIds,
					},
				},
				{
					projection: rundownFieldSpecifier,
				}
			).observe(cache.Rundowns.link()),
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
			PartInstances.find(
				{ rundownId: { $in: rundownIds }, reset: { $ne: true }, orphaned: 'deleted' },
				{ fields: partInstanceFieldSpecifier }
			).observe(cache.DeletedPartInstances.link()),
		]
	}

	public get cache(): ContentCache {
		return this.#cache
	}

	public dispose = (): void => {
		this.#observers.forEach((observer) => observer.stop())
	}
}
