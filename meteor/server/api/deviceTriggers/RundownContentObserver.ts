import { Meteor } from 'meteor/meteor'
import {
	RundownId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
	ShowStyleBaseId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { AdLibActions } from '../../../lib/collections/AdLibActions'
import { AdLibPieces } from '../../../lib/collections/AdLibPieces'
import { PartInstances } from '../../../lib/collections/PartInstances'
import { Parts } from '../../../lib/collections/Parts'
import { RundownBaselineAdLibActions } from '../../../lib/collections/RundownBaselineAdLibActions'
import { RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { Segments } from '../../../lib/collections/Segments'
import { ShowStyleBases } from '../../../lib/collections/ShowStyleBases'
import { TriggeredActions } from '../../../lib/collections/TriggeredActions'
import { logger } from '../../logging'
import { ContentCache, createReactiveContentCache } from './reactiveContentCache'

const REACTIVITY_DEBOUNCE = 5

type ChangedHandler = (cache: ContentCache) => () => void

export class RundownContentObserver {
	#observers: Meteor.LiveQueryHandle[]
	#cache: ContentCache
	#cancelCache: () => void
	#cleanup: () => void

	constructor(
		rundownPlaylistId: RundownPlaylistId,
		showStyleBaseId: ShowStyleBaseId,
		rundownIds: RundownId[],
		activationId: RundownPlaylistActivationId,
		onChanged: ChangedHandler
	) {
		logger.debug(`Creating RundownContentObserver for playlist "${rundownPlaylistId}" activation "${activationId}"`)
		const { cache, cancel: cancelCache } = createReactiveContentCache(() => {
			logger.debug(`DeviceTriggers observer reacting to change in RundownPlaylist "${rundownPlaylistId}"`)
			this.#cleanup = onChanged(cache)
		}, REACTIVITY_DEBOUNCE)

		this.#cache = cache
		this.#cancelCache = cancelCache

		this.#observers = [
			RundownPlaylists.find(rundownPlaylistId, {
				projection: {
					_id: 1,
					name: 1,
					activationId: 1,
					currentPartInstanceId: 1,
					nextPartInstanceId: 1,
				},
			}).observe(cache.RundownPlaylists.link()),
			ShowStyleBases.find(showStyleBaseId).observe(cache.ShowStyleBases.link()),
			TriggeredActions.find({
				showStyleBaseId: {
					$in: [showStyleBaseId, null],
				},
			}).observe(cache.TriggeredActions.link()),
			Segments.find({
				rundownId: {
					$in: rundownIds,
				},
			}).observe(cache.Segments.link()),
			Parts.find({
				rundownId: {
					$in: rundownIds,
				},
			}).observe(cache.Parts.link()),
			PartInstances.find(
				{
					playlistActivationId: activationId,
					reset: {
						$ne: true,
					},
				},
				{
					projection: {
						_id: 1,
						part: 1,
					},
				}
			).observe(cache.PartInstances.link()),
			RundownBaselineAdLibActions.find({
				rundownId: {
					$in: rundownIds,
				},
			}).observe(cache.RundownBaselineAdLibActions.link()),
			RundownBaselineAdLibPieces.find({
				rundownId: {
					$in: rundownIds,
				},
			}).observe(cache.RundownBaselineAdLibPieces.link()),
			AdLibActions.find({
				rundownId: {
					$in: rundownIds,
				},
			}).observe(cache.AdLibActions.link()),
			AdLibPieces.find({
				rundownId: {
					$in: rundownIds,
				},
			}).observe(cache.AdLibPieces.link()),
		]
	}

	public get cache(): ContentCache {
		return this.#cache
	}

	public dispose = (): void => {
		logger.debug(`Destroying RundownContentObserver`)
		this.#cancelCache()
		this.#observers.forEach((observer) => observer.stop())
		this.#cleanup()
	}
}
