import { Meteor } from 'meteor/meteor'
import { RundownId, RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import _ from 'underscore'
import { Rundowns } from '../../collections'

const REACTIVITY_DEBOUNCE = 20

type ChangedHandler = (rundownIds: RundownId[]) => () => void

/**
 * A mongo observer/query for the RundownIds in a playlist.
 * Note: Updates are debounced to avoid rapid updates firing
 */
export class RundownsObserver implements Meteor.LiveQueryHandle {
	#rundownsLiveQuery: Meteor.LiveQueryHandle
	#rundownIds: Set<RundownId> = new Set<RundownId>()
	#changed: ChangedHandler | undefined
	#cleanup: (() => void) | undefined

	constructor(studioId: StudioId, playlistId: RundownPlaylistId, onChanged: ChangedHandler) {
		this.#changed = onChanged
		const cursor = Rundowns.find(
			{
				playlistId,
				studioId,
			},
			{
				projection: {
					_id: 1,
				},
			}
		)
		this.#rundownsLiveQuery = cursor.observe({
			added: (doc) => {
				this.#rundownIds.add(doc._id)
				this.updateRundownContent()
			},
			changed: (doc) => {
				this.#rundownIds.add(doc._id)
				this.updateRundownContent()
			},
			removed: (doc) => {
				this.#rundownIds.delete(doc._id)
				this.updateRundownContent()
			},
		})
		this.updateRundownContent()
	}

	public get rundownIds(): RundownId[] {
		return Array.from(this.#rundownIds)
	}

	private innerUpdateRundownContent = () => {
		if (!this.#changed) return
		const changed = this.#changed
		this.#cleanup = changed(this.rundownIds)
	}

	public updateRundownContent = _.debounce(
		Meteor.bindEnvironment(this.innerUpdateRundownContent),
		REACTIVITY_DEBOUNCE
	)

	public stop = (): void => {
		this.updateRundownContent.cancel()
		this.#rundownsLiveQuery.stop()
		this.#changed = undefined
		this.#cleanup?.()
	}
}
