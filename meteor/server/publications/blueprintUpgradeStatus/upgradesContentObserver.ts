import { Meteor } from 'meteor/meteor'
import { logger } from '../../logging'
import {
	blueprintFieldSpecifier,
	ContentCache,
	showStyleFieldSpecifier,
	studioFieldSpecifier,
} from './reactiveContentCache'
import { Blueprints, ShowStyleBases, Studios } from '../../collections'

export class UpgradesContentObserver {
	#observers: Meteor.LiveQueryHandle[] = []
	#cache: ContentCache

	constructor(cache: ContentCache) {
		logger.silly(`Creating UpgradesContentObserver`)
		this.#cache = cache

		this.#observers = [
			Studios.observeChanges({}, cache.Studios.link(), {
				projection: studioFieldSpecifier,
			}),
			ShowStyleBases.observeChanges({}, cache.ShowStyleBases.link(), {
				projection: showStyleFieldSpecifier,
			}),
			Blueprints.observeChanges({}, cache.Blueprints.link(), {
				projection: blueprintFieldSpecifier,
			}),
		]
	}

	public get cache(): ContentCache {
		return this.#cache
	}

	public stop = (): void => {
		this.#observers.forEach((observer) => observer.stop())
	}
}
