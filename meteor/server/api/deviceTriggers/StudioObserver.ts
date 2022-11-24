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

const REACTIVITY_DEBOUNCE = 5

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
								nextPartInstanceId: 1,
								currentPartInstanceId: 1,
								activationId: 1,
							},
							limit: 1,
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
				if (!state) {
					this.activePlaylistId = undefined
					this.activationId = undefined
					this.#showStyleOfRundownLiveQuery?.stop()
					return
				}

				const currentRundownId = state.activePartInstance?.rundownId
				const activePlaylistId = state.activePlaylist?._id
				const activationId = state.activePlaylist?.activationId
				if (
					currentRundownId === this.currentRundownId &&
					activePlaylistId === this.activePlaylistId &&
					activationId === this.activationId
				)
					return

				logger.debug(`ActivePlaylistId is: "${activePlaylistId}", was: "${this.activePlaylistId}"`)
				logger.debug(`activationId is: "${activationId}", was: "${this.activationId}"`)
				logger.debug(`currentRundownId is: "${currentRundownId}", was: "${this.currentRundownId}"`)

				this.#showStyleOfRundownLiveQuery?.stop()
				this.#showStyleOfRundownLiveQuery = undefined

				this.activePlaylistId = activePlaylistId
				this.activationId = activationId
				this.currentRundownId = currentRundownId

				if (!currentRundownId) return
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
			stop: chain.stop,
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
				if (!this.activePlaylistId || !this.activationId) return
				const showStyleBaseId = state?.showStyleBase._id

				logger.debug(`Current showStyleBaseId is "${this.showStyleBaseId}", turning to "${showStyleBaseId}"`)
				if (showStyleBaseId === undefined) {
					this.#rundownsLiveQuery?.stop()
					this.#rundownsLiveQuery = undefined
					return
				}

				if (showStyleBaseId === this.showStyleBaseId) return

				logger.debug(`Stopping #rundownsLiveQuery...`)

				this.#rundownsLiveQuery?.stop()
				this.#rundownsLiveQuery = undefined

				const activePlaylistId = this.activePlaylistId
				const activationId = this.activationId
				this.showStyleBaseId = showStyleBaseId

				const obs0 = new RundownsObserver(
					activePlaylistId,
					Meteor.bindEnvironment((rundownIds) => {
						const obs1 = new RundownContentObserver(
							activePlaylistId,
							showStyleBaseId,
							rundownIds,
							activationId,
							Meteor.bindEnvironment((cache) => {
								this.#cleanup = this.#changed(showStyleBaseId, cache)

								return () => {
									logger.debug('Destroying old RundownContentObserver')
								}
							})
						)

						return () => {
							logger.debug('Destroying old RundownsObserver')
							this.#cleanup?.()
							obs1.dispose()
						}
					})
				)

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
