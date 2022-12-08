import { RundownId, RundownPlaylistId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import EventEmitter from 'events'
import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import { Rundowns } from '../../../lib/collections/Rundowns'
import { logger } from '../../logging'
import { ContentCache } from './reactiveContentCache'
import { RundownContentObserver } from './rundownContentObserver'
import { RundownsObserver } from './rundownsObserver'

type ChangedHandler = (cache: ContentCache) => () => void

// TODO - ditch this
export class RundownPlaylistObserver extends EventEmitter {
	readonly #observer: RundownsObserver

	#changed: ChangedHandler
	#cleanup: (() => void) | undefined

	constructor(rundownPlaylistId: RundownPlaylistId, onChanged: ChangedHandler) {
		super()
		this.#changed = onChanged

		this.#observer = new RundownsObserver(rundownPlaylistId, (rundownIds) => {
			logger.silly(`Creating new RundownContentObserver`)
			const obs1 = new RundownContentObserver(rundownIds, (cache) => {
				this.#cleanup = this.#changed(cache)

				return () => {
					void 0
				}
			})

			return () => {
				obs1.dispose()
				this.#cleanup?.()
			}
		})
	}

	public dispose = (): void => {
		this.#observer?.dispose()
	}
}
