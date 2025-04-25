import { PackageInfo, IStudioBaselineContext } from '@sofie-automation/blueprints-integration'
import { WatchedPackagesHelper } from './watchedPackages'
import { JobContext } from '../../jobs'
import { ContextInfo } from './CommonContext'
import { StudioContext } from './StudioContext'
import { getMediaObjectDuration } from './lib'

export class StudioBaselineContext extends StudioContext implements IStudioBaselineContext {
	private readonly jobContext: JobContext

	constructor(
		contextInfo: ContextInfo,
		context: JobContext,
		private readonly watchedPackages: WatchedPackagesHelper
	) {
		super(contextInfo, context.studio, context.getStudioBlueprintConfig())
		this.jobContext = context
	}

	getPackageInfo(packageId: string): readonly PackageInfo.Any[] {
		return this.watchedPackages.getPackageInfo(packageId)
	}

	async hackGetMediaObjectDuration(mediaId: string): Promise<number | undefined> {
		return getMediaObjectDuration(this.jobContext, mediaId)
	}
}
