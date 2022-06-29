import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { TimelineComplete } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { JobContext } from '../jobs'
import { CacheBase } from '../cache/CacheBase'
import { DbCacheReadCollection, DbCacheWriteCollection } from '../cache/CacheCollection'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'

export interface CacheForStudioBase {
	readonly PeripheralDevices: DbCacheReadCollection<PeripheralDevice>

	readonly Timeline: DbCacheWriteCollection<TimelineComplete>
}

/**
 * This is a cache used for studio operations.
 */
export class CacheForStudio extends CacheBase<CacheForStudio> implements CacheForStudioBase {
	public readonly isStudio = true

	public readonly PeripheralDevices: DbCacheReadCollection<PeripheralDevice>

	public readonly RundownPlaylists: DbCacheReadCollection<DBRundownPlaylist>
	public readonly Timeline: DbCacheWriteCollection<TimelineComplete>

	private constructor(
		context: JobContext,
		peripheralDevices: DbCacheReadCollection<PeripheralDevice>,
		rundownPlaylists: DbCacheReadCollection<DBRundownPlaylist>,
		timeline: DbCacheWriteCollection<TimelineComplete>
	) {
		super(context)

		this.PeripheralDevices = peripheralDevices

		this.RundownPlaylists = rundownPlaylists
		this.Timeline = timeline
	}

	public get DisplayName(): string {
		return `CacheForStudio`
	}

	static async create(context: JobContext): Promise<CacheForStudio> {
		const span = context.startSpan('CacheForStudio.create')

		const studioId = context.studioId

		const collections = await Promise.all([
			DbCacheReadCollection.createFromDatabase(context, context.directCollections.PeripheralDevices, {
				studioId,
			}),
			DbCacheReadCollection.createFromDatabase(context, context.directCollections.RundownPlaylists, { studioId }),
			DbCacheWriteCollection.createFromDatabase(context, context.directCollections.Timelines, { _id: studioId }),
		])

		const res = new CacheForStudio(context, ...collections)
		if (span) span.end()
		return res
	}

	public getActiveRundownPlaylists(excludeRundownPlaylistId?: RundownPlaylistId): DBRundownPlaylist[] {
		return this.RundownPlaylists.findFetch({
			activationId: { $exists: true },
			_id: {
				$ne: excludeRundownPlaylistId || protectString(''),
			},
		})
	}
}
