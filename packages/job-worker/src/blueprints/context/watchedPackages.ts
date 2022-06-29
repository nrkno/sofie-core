import { DbCacheReadCollection } from '../../cache/CacheCollection'
import { ExpectedPackageDB, ExpectedPackageDBBase } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { PackageInfoDB } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'
import { JobContext } from '../../jobs'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Filter as FilterQuery } from 'mongodb'
import { PackageInfo } from '@sofie-automation/blueprints-integration'
import { unprotectObjectArray } from '@sofie-automation/corelib/dist/protectedString'
import { CacheForIngest } from '../../ingest/cache'

/**
 * This is a helper class to simplify exposing packageInfo to various places in the blueprints
 */
export class WatchedPackagesHelper {
	private constructor(
		private readonly packages: DbCacheReadCollection<ExpectedPackageDB>,
		private readonly packageInfos: DbCacheReadCollection<PackageInfoDB>
	) {}

	/**
	 * Create a helper with no packages. This should be used where the api is in place, but the update flow hasnt been implemented yet so we don't want to expose any data
	 */
	static empty(context: JobContext): WatchedPackagesHelper {
		const watchedPackages = DbCacheReadCollection.createFromArray(
			context,
			context.directCollections.ExpectedPackages,
			[]
		)
		const watchedPackageInfos = DbCacheReadCollection.createFromArray(
			context,
			context.directCollections.PackageInfos,
			[]
		)

		return new WatchedPackagesHelper(watchedPackages, watchedPackageInfos)
	}

	/**
	 * Create a helper, and populate it with data from the database
	 * @param studioId The studio this is for
	 * @param filter A mongo query to specify the packages that should be included
	 */
	static async create<T extends ExpectedPackageDBBase = ExpectedPackageDBBase>(
		context: JobContext,
		studioId: StudioId,
		filter: FilterQuery<Omit<T, 'studioId'>>
	): Promise<WatchedPackagesHelper> {
		// Load all the packages and the infos that are watched
		const watchedPackages = await DbCacheReadCollection.createFromDatabase(
			context,
			context.directCollections.ExpectedPackages,
			{
				...filter,
				studioId: studioId,
			} as any
		) // TODO: don't use any here
		const watchedPackageInfos = await DbCacheReadCollection.createFromDatabase(
			context,
			context.directCollections.PackageInfos,
			{
				studioId: studioId,
				packageId: { $in: watchedPackages.findFetch({}).map((p) => p._id) },
			}
		)

		return new WatchedPackagesHelper(watchedPackages, watchedPackageInfos)
	}

	/**
	 * Create a helper, and populate it with data from a CacheForIngest
	 * @param studioId The studio this is for
	 * @param filter A filter to check if each package should be included
	 */
	static async createForIngest(
		context: JobContext,
		cache: CacheForIngest,
		func: ((pkg: ExpectedPackageDB) => boolean) | undefined
	): Promise<WatchedPackagesHelper> {
		const packages = cache.ExpectedPackages.findFetch(func ?? {})

		// Load all the packages and the infos that are watched
		const watchedPackages = DbCacheReadCollection.createFromArray(
			context,
			context.directCollections.ExpectedPackages,
			packages
		)
		const watchedPackageInfos = await DbCacheReadCollection.createFromDatabase(
			context,
			context.directCollections.PackageInfos,
			{
				studioId: context.studio._id,
				packageId: { $in: packages.map((p) => p._id) },
			}
		)

		return new WatchedPackagesHelper(watchedPackages, watchedPackageInfos)
	}

	/**
	 * Create a new helper with a subset of the data in the current helper.
	 * This is useful so that all the data for a rundown can be loaded at the start of an ingest operation, and then subsets can be taken for particular blueprint methods without needing to do more db operations.
	 * @param func A filter to check if each package should be included
	 */
	filter(context: JobContext, func: (pkg: ExpectedPackageDB) => boolean): WatchedPackagesHelper {
		const watchedPackages = DbCacheReadCollection.createFromArray(
			context,
			context.directCollections.ExpectedPackages,
			this.packages.findFetch(func)
		)

		const newPackageIds = new Set(watchedPackages.findFetch({}).map((p) => p._id))
		const watchedPackageInfos = DbCacheReadCollection.createFromArray(
			context,
			context.directCollections.PackageInfos,
			this.packageInfos.findFetch((info) => newPackageIds.has(info.packageId))
		)

		return new WatchedPackagesHelper(watchedPackages, watchedPackageInfos)
	}

	getPackageInfo(packageId: string): Readonly<Array<PackageInfo.Any>> {
		const pkg = this.packages.findOne({
			blueprintPackageId: packageId,
		})
		if (pkg) {
			const info = this.packageInfos.findFetch({
				packageId: pkg._id,
			})
			return unprotectObjectArray(info)
		} else {
			return []
		}
	}
}
