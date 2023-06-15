import { Meteor } from 'meteor/meteor'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../logging'
import {
	ContentCache,
	createReactiveContentCache,
	partFieldSpecifier,
	partInstanceFieldSpecifier,
	rundownFieldSpecifier,
	segmentFieldSpecifier,
} from './reactiveContentCache'
import { PartInstances, Parts, Rundowns, Segments } from '../../collections'

const REACTIVITY_DEBOUNCE = 20

type ChangedHandler = (cache: ContentCache) => () => void

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

		this.#observers = [
			Rundowns.observe(
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
			PartInstances.observe(
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
		this.#cancelCache()
		this.#observers.forEach((observer) => observer.stop())
		this.#cleanup()
	}
}
