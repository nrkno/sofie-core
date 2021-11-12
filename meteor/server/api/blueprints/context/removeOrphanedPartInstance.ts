import { IRemoveOrphanedPartInstanceContext } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { INoteBase, NoteType } from '../../../../lib/api/notes'
import { Rundown } from '../../../../lib/collections/Rundowns'
import { ShowStyleCompound } from '../../../../lib/collections/ShowStyleVariants'
import { Studio } from '../../../../lib/collections/Studios'
import { ContextInfo, RundownContext } from './context'

export class RemoveOrphanedPartInstanceContext extends RundownContext implements IRemoveOrphanedPartInstanceContext {
	/**
	 * Set to true if blueprints have requested that the instance be removed
	 */
	private removeInstance: boolean
	public readonly notes: INoteBase[] = []
	private readonly tempSendNotesIntoBlackHole: boolean

	constructor(
		contextInfo: ContextInfo,
		studio: ReadonlyDeep<Studio>,
		showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
		rundown: ReadonlyDeep<Rundown>
	) {
		super(contextInfo, studio, showStyleCompound, rundown)
	}

	notifyUserError(message: string, params?: { [key: string]: any }): void {
		if (this.tempSendNotesIntoBlackHole) {
			this.logError(`UserNotes: "${message}", ${JSON.stringify(params)}`)
		} else {
			this.notes.push({
				type: NoteType.ERROR,
				message: {
					key: message,
					args: params,
				},
			})
		}
	}
	notifyUserWarning(message: string, params?: { [key: string]: any }): void {
		if (this.tempSendNotesIntoBlackHole) {
			this.logWarning(`UserNotes: "${message}", ${JSON.stringify(params)}`)
		} else {
			this.notes.push({
				type: NoteType.WARNING,
				message: {
					key: message,
					args: params,
				},
			})
		}
	}

	removePartInstance() {
		this.removeInstance = true
	}

	public instanceIsRemoved(): boolean {
		return this.removeInstance
	}
}
