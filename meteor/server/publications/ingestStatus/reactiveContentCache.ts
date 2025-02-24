import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { ReactiveCacheCollection } from '../lib/ReactiveCacheCollection'
import { literal } from '@sofie-automation/corelib/dist/lib'
import type { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import type { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import type { NrcsIngestDataCacheObj } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'
import type { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'

export type PlaylistFields = '_id' | 'activationId' | 'rehearsal' | 'currentPartInfo' | 'nextPartInfo'
export const playlistFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBRundownPlaylist, PlaylistFields>>>({
	_id: 1,
	activationId: 1,
	rehearsal: 1,
	currentPartInfo: 1,
	nextPartInfo: 1,
})

export type RundownFields = '_id' | 'externalId' | 'playlistId'
export const rundownFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBRundown, RundownFields>>>({
	_id: 1,
	externalId: 1,
	playlistId: 1,
})

export type PartFields =
	| '_id'
	| 'rundownId'
	| 'segmentId'
	| 'externalId'
	| 'shouldNotifyCurrentPlayingPart'
	| 'ingestNotifyPartReady'
	| 'ingestNotifyItemsReady'
	| 'ingestNotifyPartExternalId'
export const partFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBPart, PartFields>>>({
	_id: 1,
	rundownId: 1,
	segmentId: 1,
	externalId: 1,
	shouldNotifyCurrentPlayingPart: 1,
	ingestNotifyPartReady: 1,
	ingestNotifyItemsReady: 1,
	ingestNotifyPartExternalId: 1,
})

export type PartInstanceFields = '_id' | 'rundownId' | 'segmentId' | 'part' | 'takeCount'
export const partInstanceFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<PartInstance, PartInstanceFields>>
>({
	_id: 1,
	rundownId: 1,
	segmentId: 1,
	part: 1, // This could be more granular, but it should be pretty stable
	takeCount: 1,
})

export interface ContentCache {
	RundownIds: RundownId[]

	Playlists: ReactiveCacheCollection<Pick<DBRundownPlaylist, PlaylistFields>>
	Rundowns: ReactiveCacheCollection<Pick<DBRundown, RundownFields>>
	NrcsIngestData: ReactiveCacheCollection<NrcsIngestDataCacheObj>
	Parts: ReactiveCacheCollection<Pick<DBPart, PartFields>>
	PartInstances: ReactiveCacheCollection<Pick<PartInstance, PartInstanceFields>>
}

export function createReactiveContentCache(rundownIds: RundownId[]): ContentCache {
	const cache: ContentCache = {
		RundownIds: rundownIds,

		Playlists: new ReactiveCacheCollection<Pick<DBRundownPlaylist, PlaylistFields>>('playlists'),
		Rundowns: new ReactiveCacheCollection<Pick<DBRundown, RundownFields>>('rundowns'),
		NrcsIngestData: new ReactiveCacheCollection<NrcsIngestDataCacheObj>('nrcsIngestData'), // TODO - is this needed?
		Parts: new ReactiveCacheCollection<Pick<DBPart, PartFields>>('parts'),
		PartInstances: new ReactiveCacheCollection<Pick<PartInstance, PartInstanceFields>>('partInstances'),
	}

	return cache
}
