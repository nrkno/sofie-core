import { Meteor } from 'meteor/meteor'
import { RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../logging'
import {
	ContentCache,
	partFieldSpecifier,
	// rundownFieldSpecifier,
	rundownPlaylistFieldSpecifier,
	segmentFieldSpecifier,
} from './reactiveContentCache'
import { Parts, RundownPlaylists, Segments } from '../../collections'

export class RundownContentObserver {
	#observers: Meteor.LiveQueryHandle[] = []
	#cache: ContentCache

	constructor(playlistId: RundownPlaylistId, rundownIds: RundownId[], cache: ContentCache) {
		logger.silly(`Creating RundownContentObserver for rundowns "${rundownIds.join(',')}"`)
		this.#cache = cache

		this.#observers = [
			RundownPlaylists.observeChanges(
				{
					_id: playlistId,
				},
				cache.RundownPlaylists.link(),
				{
					fields: rundownPlaylistFieldSpecifier,
				}
			),
			// Rundowns.observeChanges(
			// 	{
			// 		_id: {
			// 			$in: rundownIds,
			// 		},
			// 	},
			// 	cache.Rundowns.link(),
			// 	{
			// 		projection: rundownFieldSpecifier,
			// 	}
			// ),
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
		]
	}

	public get cache(): ContentCache {
		return this.#cache
	}

	public dispose = (): void => {
		this.#observers.forEach((observer) => observer.stop())
	}
}
