import { IStudioUserContext, NoteSeverity } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { ProcessedStudioConfig } from '../config'
import { INoteBase } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { UserContextInfo } from './CommonContext'
import { StudioContext } from './StudioContext'

export class StudioUserContext extends StudioContext implements IStudioUserContext {
	public readonly notes: INoteBase[] = []
	private readonly tempSendNotesIntoBlackHole: boolean

	constructor(
		contextInfo: UserContextInfo,
		studio: ReadonlyDeep<DBStudio>,
		studioBlueprintConfig: ProcessedStudioConfig
	) {
		super(contextInfo, studio, studioBlueprintConfig)
		this.tempSendNotesIntoBlackHole = contextInfo.tempSendUserNotesIntoBlackHole ?? false
	}

	notifyUserError(message: string, params?: { [key: string]: any }): void {
		this.addNote(NoteSeverity.ERROR, message, params)
	}
	notifyUserWarning(message: string, params?: { [key: string]: any }): void {
		this.addNote(NoteSeverity.WARNING, message, params)
	}

	notifyUserInfo(message: string, params?: { [key: string]: any }): void {
		this.addNote(NoteSeverity.INFO, message, params)
	}
	private addNote(type: NoteSeverity, message: string, params?: { [key: string]: any }) {
		if (this.tempSendNotesIntoBlackHole) {
			this.logNote(`UserNotes: "${message}", ${JSON.stringify(params)}`, type)
		} else {
			this.notes.push({
				type: type,
				message: {
					key: message,
					args: params,
				},
			})
		}
	}
}
