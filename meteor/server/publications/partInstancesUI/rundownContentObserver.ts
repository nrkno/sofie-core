import { Meteor } from 'meteor/meteor'
import { RundownId, RundownPlaylistActivationId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../logging'
import {
	ContentCache,
	partInstanceFieldSpecifier,
	rundownPlaylistFieldSpecifier,
	segmentFieldSpecifier,
	studioFieldSpecifier,
} from './reactiveContentCache'
import { PartInstances, RundownPlaylists, Segments, Studios } from '../../collections'

export class RundownContentObserver {
	#observers: Meteor.LiveQueryHandle[] = []
	#cache: ContentCache

	constructor(
		studioId: StudioId,
		playlistActivationId: RundownPlaylistActivationId,
		rundownIds: RundownId[],
		cache: ContentCache
	) {
		logger.silly(`Creating RundownContentObserver for rundowns "${rundownIds.join(',')}"`)
		this.#cache = cache

		this.#observers = [
			Studios.observeChanges(
				{
					_id: studioId,
				},
				cache.Studios.link(),
				{
					fields: studioFieldSpecifier,
				}
			),
			RundownPlaylists.observeChanges(
				{
					activationId: playlistActivationId,
				},
				cache.RundownPlaylists.link(),
				{
					fields: rundownPlaylistFieldSpecifier,
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
			PartInstances.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
					playlistActivationId,
					reset: { $ne: true },
				},
				cache.PartInstances.link(),
				{
					projection: partInstanceFieldSpecifier,
				}
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
