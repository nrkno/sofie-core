import { PackageInfo, IStudioBaselineContext } from '@sofie-automation/blueprints-integration'
import { WatchedPackagesHelper } from './watchedPackages'
import { JobContext } from '../../jobs'
import { UserContextInfo } from './CommonContext'
import { StudioContext } from './StudioContext'
import { getMediaObjectDuration } from './lib'
import { ProcessedStudioConfig } from '../config'

export class StudioBaselineContext extends StudioContext implements IStudioBaselineContext {
	private readonly jobContext: JobContext

	constructor(
		contextInfo: UserContextInfo,
		context: JobContext,
		studioConfig: ProcessedStudioConfig,
		private readonly watchedPackages: WatchedPackagesHelper
	) {
		super(contextInfo, context.studio, studioConfig)
		this.jobContext = context
	}

	async getPackageInfo(packageId: string): Promise<Readonly<Array<PackageInfo.Any>>> {
		return this.watchedPackages.getPackageInfo(packageId)
	}

	async hackGetMediaObjectDuration(mediaId: string): Promise<number | undefined> {
		return getMediaObjectDuration(this.jobContext, mediaId)
	}
}
