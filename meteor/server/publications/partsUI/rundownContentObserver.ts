import { Meteor } from 'meteor/meteor'
import { RundownId, RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../logging'
import {
	ContentCache,
	partFieldSpecifier,
	rundownPlaylistFieldSpecifier,
	segmentFieldSpecifier,
	studioFieldSpecifier,
} from './reactiveContentCache'
import { Parts, RundownPlaylists, Segments, Studios } from '../../collections'
import { waitForAllObserversReady } from '../lib/lib'

export class RundownContentObserver {
	readonly #cache: ContentCache
	readonly #observers: Meteor.LiveQueryHandle[]

	private constructor(cache: ContentCache, observers: Meteor.LiveQueryHandle[]) {
		this.#cache = cache
		this.#observers = observers
	}

	static async create(
		studioId: StudioId,
		playlistId: RundownPlaylistId,
		rundownIds: RundownId[],
		cache: ContentCache
	): Promise<RundownContentObserver> {
		logger.silly(`Creating RundownContentObserver for rundowns "${rundownIds.join(',')}"`)

		const observers = await waitForAllObserversReady([
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
					_id: playlistId,
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
		])

		return new RundownContentObserver(cache, observers)
	}

	public get cache(): ContentCache {
		return this.#cache
	}

	public dispose = (): void => {
		this.#observers.forEach((observer) => observer.stop())
	}
}
