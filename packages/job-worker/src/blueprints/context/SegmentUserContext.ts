import { PackageInfo, ISegmentUserContext, NoteSeverity } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { WatchedPackagesHelper } from './watchedPackages'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs'
import { ContextInfo } from './CommonContext'
import { RundownContext } from './RundownContext'
import { INoteBase } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { getMediaObjectDuration } from './lib'

export interface RawPartNote extends INoteBase {
	partExternalId: string | undefined
}

export class SegmentUserContext extends RundownContext implements ISegmentUserContext {
	public readonly notes: RawPartNote[] = []

	private readonly jobContext: JobContext

	constructor(
		contextInfo: ContextInfo,
		context: JobContext,
		showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
		rundown: ReadonlyDeep<DBRundown>,
		private readonly watchedPackages: WatchedPackagesHelper
	) {
		super(
			contextInfo,
			context.studio,
			context.getStudioBlueprintConfig(),
			showStyleCompound,
			context.getShowStyleBlueprintConfig(showStyleCompound),
			rundown
		)
		this.jobContext = context
	}

	notifyUserError(message: string, params?: { [key: string]: any }, partExternalId?: string): void {
		this.notes.push({
			type: NoteSeverity.ERROR,
			message: {
				key: message,
				args: params,
			},
			partExternalId: partExternalId,
		})
	}
	notifyUserWarning(message: string, params?: { [key: string]: any }, partExternalId?: string): void {
		this.notes.push({
			type: NoteSeverity.WARNING,
			message: {
				key: message,
				args: params,
			},
			partExternalId: partExternalId,
		})
	}

	notifyUserInfo(message: string, params?: { [key: string]: any }, partExternalId?: string): void {
		this.notes.push({
			type: NoteSeverity.INFO,
			message: {
				key: message,
				args: params,
			},
			partExternalId: partExternalId,
		})
	}

	getPackageInfo(packageId: string): Readonly<Array<PackageInfo.Any>> {
		return this.watchedPackages.getPackageInfo(packageId)
	}

	async hackGetMediaObjectDuration(mediaId: string): Promise<number | undefined> {
		return getMediaObjectDuration(this.jobContext, mediaId)
	}
}
