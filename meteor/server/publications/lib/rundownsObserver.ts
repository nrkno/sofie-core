import { Meteor } from 'meteor/meteor'
import { RundownId, RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Rundowns } from '../../collections'
import { PromiseDebounce } from './PromiseDebounce'
import { logger } from '../../logging'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

const REACTIVITY_DEBOUNCE = 20

type ChangedHandler = (rundownIds: RundownId[]) => Promise<() => void>

/**
 * A mongo observer/query for the RundownIds in a playlist.
 * Note: Updates are debounced to avoid rapid updates firing
 */
export class RundownsObserver implements Meteor.LiveQueryHandle {
	#rundownsLiveQuery!: Meteor.LiveQueryHandle
	#rundownIds: Set<RundownId> = new Set<RundownId>()
	#changed: ChangedHandler | undefined
	#cleanup: (() => void) | undefined

	#disposed = false

	readonly #triggerUpdateRundownContent = new PromiseDebounce(async () => {
		try {
			if (this.#disposed) return
			if (!this.#changed) return
			this.#cleanup?.()
			this.#cleanup = undefined

			const changed = this.#changed
			this.#cleanup = await changed(this.rundownIds)

			if (this.#disposed) {
				this.#cleanup?.()
				this.#cleanup = undefined
			}
		} catch (e) {
			logger.error(`Error in RundownsObserver triggerUpdateRundownContent: ${stringifyError(e)}`)
		}
	}, REACTIVITY_DEBOUNCE)

	private constructor(onChanged: ChangedHandler) {
		this.#changed = onChanged
	}

	static async create(
		studioId: StudioId,
		playlistId: RundownPlaylistId,
		onChanged: ChangedHandler
	): Promise<RundownsObserver> {
		const observer = new RundownsObserver(onChanged)

		await observer.init(studioId, playlistId)

		return observer
	}

	private async init(studioId: StudioId, playlistId: RundownPlaylistId) {
		this.#rundownsLiveQuery = await Rundowns.observe(
			{
				playlistId,
				studioId,
			},
			{
				added: (doc) => {
					this.#rundownIds.add(doc._id)
					this.#triggerUpdateRundownContent.trigger()
				},
				changed: (doc) => {
					this.#rundownIds.add(doc._id)
					this.#triggerUpdateRundownContent.trigger()
				},
				removed: (doc) => {
					this.#rundownIds.delete(doc._id)
					this.#triggerUpdateRundownContent.trigger()
				},
			},
			{
				projection: {
					_id: 1,
				},
			}
		)

		this.#triggerUpdateRundownContent.trigger()
	}

	public get rundownIds(): RundownId[] {
		return Array.from(this.#rundownIds)
	}

	public stop = (): void => {
		this.#disposed = true

		this.#triggerUpdateRundownContent.cancelWaiting()
		this.#rundownsLiveQuery.stop()
		this.#changed = undefined
		this.#cleanup?.()
	}
}
