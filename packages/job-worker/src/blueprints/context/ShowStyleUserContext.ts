import { PackageInfo, IShowStyleUserContext, NoteSeverity } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { WatchedPackagesHelper } from './watchedPackages'
import { INoteBase } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs'
import { UserContextInfo } from './CommonContext'
import { ShowStyleContext } from './ShowStyleContext'
import { getMediaObjectDuration } from './lib'

export class ShowStyleUserContext extends ShowStyleContext implements IShowStyleUserContext {
	public readonly notes: INoteBase[] = []

	private readonly tempSendNotesIntoBlackHole: boolean
	protected readonly jobContext: JobContext

	constructor(
		contextInfo: UserContextInfo,
		context: JobContext,
		showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
		private readonly watchedPackages: WatchedPackagesHelper
	) {
		super(
			contextInfo,
			context.studio,
			context.getStudioBlueprintConfig(),
			showStyleCompound,
			context.getShowStyleBlueprintConfig(showStyleCompound)
		)
		this.tempSendNotesIntoBlackHole = contextInfo.tempSendUserNotesIntoBlackHole ?? false
		this.jobContext = context
	}

	notifyUserError(message: string, params?: { [key: string]: any }): void {
		if (this.tempSendNotesIntoBlackHole) {
			this.logError(`UserNotes: "${message}", ${JSON.stringify(params)}`)
		} else {
			this.notes.push({
				type: NoteSeverity.ERROR,
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
				type: NoteSeverity.WARNING,
				message: {
					key: message,
					args: params,
				},
			})
		}
	}

	notifyUserInfo(message: string, params?: { [key: string]: any }): void {
		if (this.tempSendNotesIntoBlackHole) {
			this.logInfo(`UserNotes: "${message}", ${JSON.stringify(params)}`)
		} else {
			this.notes.push({
				type: NoteSeverity.INFO,
				message: {
					key: message,
					args: params,
				},
			})
		}
	}

	getPackageInfo(packageId: string): Readonly<Array<PackageInfo.Any>> {
		return this.watchedPackages.getPackageInfo(packageId)
	}

	async hackGetMediaObjectDuration(mediaId: string): Promise<number | undefined> {
		return getMediaObjectDuration(this.jobContext, mediaId)
	}
}
