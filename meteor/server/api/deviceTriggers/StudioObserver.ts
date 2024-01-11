import {
	RundownId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
	ShowStyleBaseId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import EventEmitter from 'events'
import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import { MongoCursor } from '../../../lib/collections/lib'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { logger } from '../../logging'
import { observerChain } from '../../publications/lib/observerChain'
import { ContentCache } from './reactiveContentCache'
import { RundownContentObserver } from './RundownContentObserver'
import { RundownsObserver } from './RundownsObserver'
import { PartInstances, RundownPlaylists, Rundowns, ShowStyleBases } from '../../collections'

type ChangedHandler = (showStyleBaseId: ShowStyleBaseId, cache: ContentCache) => () => void

const REACTIVITY_DEBOUNCE = 20

type RundownPlaylistFields = '_id' | 'nextPartInfo' | 'currentPartInfo' | 'activationId'
const rundownPlaylistFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<DBRundownPlaylist, RundownPlaylistFields>>
>({
	_id: 1,
	activationId: 1,
	currentPartInfo: 1,
	nextPartInfo: 1,
})

type PartInstanceFields = '_id' | 'rundownId'
const partInstanceFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBPartInstance, PartInstanceFields>>>({
	_id: 1,
	rundownId: 1,
})

type RundownFields = '_id' | 'showStyleBaseId'
const rundownFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBRundown, RundownFields>>>({
	_id: 1,
	showStyleBaseId: 1,
})

type ShowStyleBaseFields = '_id' | 'sourceLayersWithOverrides' | 'outputLayersWithOverrides' | 'hotkeyLegend'
const showStyleBaseFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBShowStyleBase, ShowStyleBaseFields>>>({
	_id: 1,
	sourceLayersWithOverrides: 1,
	outputLayersWithOverrides: 1,
	hotkeyLegend: 1,
})

interface StudioObserverProps {
	activePlaylistId: RundownPlaylistId
	activationId: RundownPlaylistActivationId
	currentRundownId: RundownId
}

export class StudioObserver extends EventEmitter {
	#playlistInStudioLiveQuery: Meteor.LiveQueryHandle
	#showStyleOfRundownLiveQuery: Meteor.LiveQueryHandle | undefined
	#rundownsLiveQuery: Meteor.LiveQueryHandle | undefined
	showStyleBaseId: ShowStyleBaseId | undefined

	currentProps: StudioObserverProps | undefined = undefined
	nextProps: StudioObserverProps | undefined = undefined

	#changed: ChangedHandler

	constructor(studioId: StudioId, onChanged: ChangedHandler) {
		super()
		this.#changed = onChanged
		this.#playlistInStudioLiveQuery = observerChain()
			.next(
				'activePlaylist',
				async () =>
					RundownPlaylists.findWithCursor(
						{
							studioId: studioId,
							activationId: { $exists: true },
						},
						{
							projection: rundownPlaylistFieldSpecifier,
						}
					) as Promise<MongoCursor<Pick<DBRundownPlaylist, RundownPlaylistFields>>>
			)
			.next('activePartInstance', async (chain) => {
				const activePartInstanceId =
					chain.activePlaylist.currentPartInfo?.partInstanceId ??
					chain.activePlaylist.nextPartInfo?.partInstanceId
				if (!activePartInstanceId) return null
				return PartInstances.findWithCursor(
					{ _id: activePartInstanceId },
					{ projection: partInstanceFieldSpecifier, limit: 1 }
				) as Promise<MongoCursor<Pick<DBPartInstance, PartInstanceFields>>>
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
					this.currentProps = undefined
					return
				}

				if (
					currentRundownId === this.currentProps?.currentRundownId &&
					activePlaylistId === this.currentProps?.activePlaylistId &&
					activationId === this.currentProps?.activationId
				)
					return

				this.#showStyleOfRundownLiveQuery?.stop()
				this.#showStyleOfRundownLiveQuery = undefined

				this.nextProps = {
					activePlaylistId,
					activationId,
					currentRundownId,
				}

				this.#showStyleOfRundownLiveQuery = this.setupShowStyleOfRundownObserver(currentRundownId)
			}
		),
		REACTIVITY_DEBOUNCE
	)

	private setupShowStyleOfRundownObserver = (rundownId: RundownId): Meteor.LiveQueryHandle => {
		return observerChain()
			.next(
				'currentRundown',
				async () =>
					Rundowns.findWithCursor({ _id: rundownId }, { fields: rundownFieldSpecifier, limit: 1 }) as Promise<
						MongoCursor<Pick<DBRundown, RundownFields>>
					>
			)
			.next('showStyleBase', async (chain) =>
				chain.currentRundown
					? (ShowStyleBases.findWithCursor(
							{ _id: chain.currentRundown.showStyleBaseId },
							{
								fields: showStyleBaseFieldSpecifier,
								limit: 1,
							}
					  ) as Promise<MongoCursor<Pick<DBShowStyleBase, ShowStyleBaseFields>>>)
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

				if (
					showStyleBaseId === undefined ||
					!this.nextProps?.activePlaylistId ||
					!this.nextProps?.activationId
				) {
					this.currentProps = undefined
					this.#rundownsLiveQuery?.stop()
					this.#rundownsLiveQuery = undefined
					this.showStyleBaseId = showStyleBaseId
					return
				}

				if (
					showStyleBaseId === this.showStyleBaseId &&
					this.nextProps?.activationId === this.currentProps?.activationId &&
					this.nextProps?.activePlaylistId === this.currentProps?.activePlaylistId &&
					this.nextProps?.currentRundownId === this.currentProps?.currentRundownId
				)
					return

				this.#rundownsLiveQuery?.stop()
				this.#rundownsLiveQuery = undefined

				this.currentProps = this.nextProps
				this.nextProps = undefined

				const { activationId, activePlaylistId } = this.currentProps

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
