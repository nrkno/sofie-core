import {
	RundownId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
	ShowStyleBaseId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import EventEmitter from 'events'
import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import { MongoCursor } from '../../../lib/collections/lib'
import { DBPartInstance, PartInstances } from '../../../lib/collections/PartInstances'
import { DBRundownPlaylist, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { DBRundown, Rundowns } from '../../../lib/collections/Rundowns'
import { DBShowStyleBase, ShowStyleBases } from '../../../lib/collections/ShowStyleBases'
import { observerChain } from '../../lib/observerChain'
import { logger } from '../../logging'
import { ContentCache } from './reactiveContentCache'
import { RundownContentObserver } from './RundownContentObserver'
import { RundownsObserver } from './RundownsObserver'

type ChangedHandler = (showStyleBaseId: ShowStyleBaseId, cache: ContentCache) => () => void

const REACTIVITY_DEBOUNCE = 20

export class StudioObserver extends EventEmitter {
	#playlistInStudioLiveQuery: Meteor.LiveQueryHandle
	#showStyleOfRundownLiveQuery: Meteor.LiveQueryHandle | undefined
	#rundownsLiveQuery: Meteor.LiveQueryHandle | undefined
	activePlaylistId: RundownPlaylistId | undefined
	activationId: RundownPlaylistActivationId | undefined
	currentRundownId: RundownId | undefined
	showStyleBaseId: ShowStyleBaseId | undefined

	#changed: ChangedHandler
	#cleanup: () => void | undefined

	constructor(studioId: StudioId, onChanged: ChangedHandler) {
		super()
		this.#changed = onChanged
		this.#playlistInStudioLiveQuery = observerChain()
			.next(
				'activePlaylist',
				() =>
					RundownPlaylists.find(
						{
							studioId: studioId,
							activationId: { $exists: true },
						},
						{
							projection: {
								_id: 1,
								nextPartInstanceId: 1,
								currentPartInstanceId: 1,
								activationId: 1,
							},
						}
					) as MongoCursor<
						Pick<DBRundownPlaylist, '_id' | 'nextPartInstanceId' | 'currentPartInstanceId' | 'activationId'>
					>
			)
			.next('activePartInstance', (chain) => {
				const activePartInstanceId =
					chain.activePlaylist.currentPartInstanceId ?? chain.activePlaylist.nextPartInstanceId
				if (!activePartInstanceId) return null
				return PartInstances.find(
					{ _id: activePartInstanceId },
					{ projection: { rundownId: 1 }, limit: 1 }
				) as MongoCursor<Pick<DBPartInstance, '_id' | 'rundownId'>>
			})
			.end(this.updatePlaylistInStudio)
	}

	private updatePlaylistInStudio = _.debounce(
		Meteor.bindEnvironment(
			(
				state: {
					activePlaylist: Pick<
						DBRundownPlaylist,
						'_id' | 'nextPartInstanceId' | 'currentPartInstanceId' | 'activationId'
					>
					activePartInstance: Pick<DBPartInstance, '_id' | 'rundownId'>
				} | null
			): void => {
				const activePlaylistId = state?.activePlaylist?._id
				const activationId = state?.activePlaylist?.activationId
				const currentRundownId = state?.activePartInstance?.rundownId

				if (!activePlaylistId || !activationId || !currentRundownId) {
					logger.silly(`Stopping showStyleOfRundown live query, due to shutdown...`)
					this.#showStyleOfRundownLiveQuery?.stop()
					this.activePlaylistId = undefined
					this.activationId = undefined
					this.currentRundownId = undefined
					return
				}

				if (
					currentRundownId === this.currentRundownId &&
					activePlaylistId === this.activePlaylistId &&
					activationId === this.activationId
				)
					return

				logger.silly(`Stopping showStyleOfRundown live query, will be restarted...`)
				this.#showStyleOfRundownLiveQuery?.stop()
				this.#showStyleOfRundownLiveQuery = undefined

				this.activePlaylistId = activePlaylistId
				this.activationId = activationId
				this.currentRundownId = currentRundownId

				this.#showStyleOfRundownLiveQuery = this.setupShowStyleOfRundownObserver(currentRundownId)
			}
		),
		REACTIVITY_DEBOUNCE
	)

	private setupShowStyleOfRundownObserver = (rundownId: RundownId): Meteor.LiveQueryHandle => {
		const chain = observerChain()
			.next(
				'currentRundown',
				() =>
					Rundowns.find({ _id: rundownId }, { fields: { showStyleBaseId: 1 }, limit: 1 }) as MongoCursor<
						Pick<DBRundown, '_id' | 'showStyleBaseId'>
					>
			)
			.next('showStyleBase', (chain) =>
				chain.currentRundown
					? (ShowStyleBases.find(
							{ _id: chain.currentRundown.showStyleBaseId },
							{
								fields: { sourceLayersWithOverrides: 1, outputLayersWithOverrides: 1, hotkeyLegend: 1 },
								limit: 1,
							}
					  ) as MongoCursor<
							Pick<
								DBShowStyleBase,
								'_id' | 'sourceLayersWithOverrides' | 'outputLayersWithOverrides' | 'hotkeyLegend'
							>
					  >)
					: null
			)
			.end(this.updateShowStyle)

		return {
			stop: () => {
				chain.stop()
			},
		}
	}

	private updateShowStyle = _.debounce(
		Meteor.bindEnvironment(
			(
				state: {
					currentRundown: Pick<DBRundown, '_id' | 'showStyleBaseId'>
					showStyleBase: Pick<
						DBShowStyleBase,
						'_id' | 'sourceLayersWithOverrides' | 'outputLayersWithOverrides' | 'hotkeyLegend'
					>
				} | null
			) => {
				const showStyleBaseId = state?.showStyleBase._id

				if (showStyleBaseId === undefined || !this.activePlaylistId || !this.activationId) {
					this.#rundownsLiveQuery?.stop()
					this.#rundownsLiveQuery = undefined
					this.showStyleBaseId = showStyleBaseId
					return
				}

				if (showStyleBaseId === this.showStyleBaseId) return

				this.#rundownsLiveQuery?.stop()
				this.#rundownsLiveQuery = undefined

				const activePlaylistId = this.activePlaylistId
				const activationId = this.activationId
				this.showStyleBaseId = showStyleBaseId

				const obs0 = new RundownsObserver(activePlaylistId, (rundownIds) => {
					const obs1 = new RundownContentObserver(
						activePlaylistId,
						showStyleBaseId,
						rundownIds,
						activationId,
						(cache) => {
							this.#cleanup = this.#changed(showStyleBaseId, cache)

							return () => {
								void 0
							}
						}
					)

					return () => {
						this.#cleanup?.()
						obs1.dispose()
					}
				})

				this.#rundownsLiveQuery = {
					stop: () => {
						obs0.dispose()
					},
				}
			}
		),
		REACTIVITY_DEBOUNCE
	)

	public dispose = (): void => {
		this.#playlistInStudioLiveQuery.stop()
		this.updatePlaylistInStudio.cancel()
	}
}
