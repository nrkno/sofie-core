import {
	RundownId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
	ShowStyleBaseId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { IncludeAllMongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import EventEmitter from 'events'
import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import { MongoCursor } from '../../../lib/collections/lib'
import { DBPartInstance } from '../../../lib/collections/PartInstances'
import { DBRundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { DBRundown } from '../../../lib/collections/Rundowns'
import { DBShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { logger } from '../../logging'
import { observerChain } from '../../publications/lib/observerChain'
import { ContentCache } from './reactiveContentCache'
import { RundownContentObserver } from './RundownContentObserver'
import { RundownsObserver } from './RundownsObserver'
import { PartInstances, RundownPlaylists, Rundowns, ShowStyleBases } from '../../collections'

type ChangedHandler = (showStyleBaseId: ShowStyleBaseId, cache: ContentCache) => () => void

const REACTIVITY_DEBOUNCE = 20

type RundownPlaylistFields = '_id' | 'nextPartInstanceId' | 'currentPartInstanceId' | 'activationId'
const rundownPlaylistFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<RundownPlaylistFields>>({
	_id: 1,
	activationId: 1,
	currentPartInstanceId: 1,
	nextPartInstanceId: 1,
})

type PartInstanceFields = '_id' | 'rundownId'
const partInstanceFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<PartInstanceFields>>({
	_id: 1,
	rundownId: 1,
})

type RundownFields = '_id' | 'showStyleBaseId'
const rundownFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<RundownFields>>({
	_id: 1,
	showStyleBaseId: 1,
})

type ShowStyleBaseFields = '_id' | 'sourceLayersWithOverrides' | 'outputLayersWithOverrides' | 'hotkeyLegend'
const showStyleBaseFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<ShowStyleBaseFields>>({
	_id: 1,
	sourceLayersWithOverrides: 1,
	outputLayersWithOverrides: 1,
	hotkeyLegend: 1,
})

export class StudioObserver extends EventEmitter {
	#playlistInStudioLiveQuery: Meteor.LiveQueryHandle
	#showStyleOfRundownLiveQuery: Meteor.LiveQueryHandle | undefined
	#rundownsLiveQuery: Meteor.LiveQueryHandle | undefined
	activePlaylistId: RundownPlaylistId | undefined
	activationId: RundownPlaylistActivationId | undefined
	currentRundownId: RundownId | undefined
	showStyleBaseId: ShowStyleBaseId | undefined

	#changed: ChangedHandler

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
							projection: rundownPlaylistFieldSpecifier,
						}
					) as MongoCursor<Pick<DBRundownPlaylist, RundownPlaylistFields>>
			)
			.next('activePartInstance', (chain) => {
				const activePartInstanceId =
					chain.activePlaylist.currentPartInstanceId ?? chain.activePlaylist.nextPartInstanceId
				if (!activePartInstanceId) return null
				return PartInstances.find(
					{ _id: activePartInstanceId },
					{ projection: partInstanceFieldSpecifier, limit: 1 }
				) as MongoCursor<Pick<DBPartInstance, PartInstanceFields>>
			})
			.end(this.updatePlaylistInStudio)
	}

	private updatePlaylistInStudio = _.debounce(
		Meteor.bindEnvironment(
			(
				state: {
					activePlaylist: Pick<DBRundownPlaylist, RundownPlaylistFields>
					activePartInstance: Pick<DBPartInstance, PartInstanceFields>
				} | null
			): void => {
				const activePlaylistId = state?.activePlaylist?._id
				const activationId = state?.activePlaylist?.activationId
				const currentRundownId = state?.activePartInstance?.rundownId

				if (!activePlaylistId || !activationId || !currentRundownId) {
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
		return observerChain()
			.next(
				'currentRundown',
				() =>
					Rundowns.find({ _id: rundownId }, { fields: rundownFieldSpecifier, limit: 1 }) as MongoCursor<
						Pick<DBRundown, RundownFields>
					>
			)
			.next('showStyleBase', (chain) =>
				chain.currentRundown
					? (ShowStyleBases.find(
							{ _id: chain.currentRundown.showStyleBaseId },
							{
								fields: showStyleBaseFieldSpecifier,
								limit: 1,
							}
					  ) as MongoCursor<Pick<DBShowStyleBase, ShowStyleBaseFields>>)
					: null
			)
			.end(this.updateShowStyle)
	}

	private updateShowStyle = _.debounce(
		Meteor.bindEnvironment(
			(
				state: {
					currentRundown: Pick<DBRundown, RundownFields>
					showStyleBase: Pick<DBShowStyleBase, ShowStyleBaseFields>
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

				let cleanupChanges: (() => void) | undefined = undefined

				this.#rundownsLiveQuery = new RundownsObserver(activePlaylistId, (rundownIds) => {
					logger.silly(`Creating new RundownContentObserver`)
					const obs1 = new RundownContentObserver(
						activePlaylistId,
						showStyleBaseId,
						rundownIds,
						activationId,
						(cache) => {
							cleanupChanges = this.#changed(showStyleBaseId, cache)

							return () => {
								void 0
							}
						}
					)

					return () => {
						obs1.stop()
						cleanupChanges?.()
					}
				})
			}
		),
		REACTIVITY_DEBOUNCE
	)

	public stop = (): void => {
		this.#playlistInStudioLiveQuery.stop()
		this.updatePlaylistInStudio.cancel()
	}
}
