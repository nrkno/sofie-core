import { PeripheralDevice, PeripheralDevices } from '../../../lib/collections/PeripheralDevices'
import {
	RundownPlaylist,
	DBRundownPlaylist,
	RundownPlaylists,
	RundownPlaylistId,
} from '../../../lib/collections/RundownPlaylists'
import { Studio, Studios, StudioId } from '../../../lib/collections/Studios'
import { Timeline, TimelineComplete } from '../../../lib/collections/Timeline'
import { protectString } from '../../../lib/lib'
import { DbCacheReadCollection, DbCacheWriteCollection } from '../../cache/CacheCollection'
import { DbCacheReadObject } from '../../cache/CacheObject'
import { CacheBase } from '../../cache/DatabaseCaches'

export interface CacheForStudioBase {
	readonly Studio: DbCacheReadObject<Studio, Studio>
	readonly PeripheralDevices: DbCacheReadCollection<PeripheralDevice, PeripheralDevice>

	readonly Timeline: DbCacheWriteCollection<TimelineComplete, TimelineComplete>
}

export class CacheForStudio extends CacheBase implements CacheForStudioBase {
	public readonly isStudio = true

	public readonly Studio: DbCacheReadObject<Studio, Studio>
	public readonly PeripheralDevices: DbCacheReadCollection<PeripheralDevice, PeripheralDevice>

	public readonly RundownPlaylists: DbCacheReadCollection<RundownPlaylist, DBRundownPlaylist>
	public readonly Timeline: DbCacheWriteCollection<TimelineComplete, TimelineComplete>

	private constructor() {
		super()

		this.Studio = new DbCacheReadObject(Studios, false)
		this.PeripheralDevices = new DbCacheReadCollection(PeripheralDevices)

		this.RundownPlaylists = new DbCacheReadCollection(RundownPlaylists)
		this.Timeline = new DbCacheWriteCollection(Timeline)
	}

	static async create(studioId: StudioId): Promise<CacheForStudio> {
		const res = new CacheForStudio()

		res.Studio._initialize(studioId)

		await Promise.all([
			res.PeripheralDevices.prepareInit({ studioId }, true), // TODO - immediate?
			res.RundownPlaylists.prepareInit({ studioId }, true), // TODO - immediate?
			res.Timeline.prepareInit({ studioId }, true), // TODO - immediate?
		])

		return res
	}

	public getActiveRundownPlaylists(excludeRundownPlaylistId?: RundownPlaylistId): RundownPlaylist[] {
		return this.RundownPlaylists.findFetch({
			active: true,
			_id: {
				$ne: excludeRundownPlaylistId || protectString(''),
			},
		})
	}
}
