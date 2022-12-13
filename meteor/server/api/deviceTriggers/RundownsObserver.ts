import { Meteor } from 'meteor/meteor'
import { RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import _ from 'underscore'
import { Rundown, Rundowns } from '../../../lib/collections/Rundowns'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { IncludeAllMongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { MongoCursor } from '../../../lib/collections/lib'

const REACTIVITY_DEBOUNCE = 20

type ChangedHandler = (rundownIds: RundownId[]) => () => void

type RundownFields = '_id'
const rundownFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<RundownFields>>({
	_id: 1,
})

export class RundownsObserver {
	#rundownsLiveQuery: Meteor.LiveQueryHandle
	#rundownIds: Set<RundownId> = new Set<RundownId>()
	#changed: ChangedHandler | undefined
	#cleanup: (() => void) | undefined

	constructor(activePlaylistId: RundownPlaylistId, onChanged: ChangedHandler) {
		this.#changed = onChanged
		const cursor = Rundowns.find(
			{
				playlistId: activePlaylistId,
			},
			{
				projection: rundownFieldSpecifier,
			}
		) as MongoCursor<Pick<Rundown, RundownFields>>
		this.#rundownsLiveQuery = cursor.observeChanges({
			added: (rundownId) => {
				this.#rundownIds.add(rundownId)
				this.updateRundownContent()
			},
			removed: (rundownId) => {
				this.#rundownIds.delete(rundownId)
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
