import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { IngestDataCacheObj } from '@sofie-automation/corelib/dist/dataModel/IngestDataCache'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PartInstance } from '../../lib/collections/PartInstances'
import { Part } from '../../lib/collections/Parts'
import { Segment } from '../../lib/collections/Segments'
import { createAsyncMongoCollection } from './collection'
import { registerIndex } from './indices'

export const AdLibActions = createAsyncMongoCollection<AdLibAction>(CollectionName.AdLibActions)
registerIndex(AdLibActions, {
	rundownId: 1,
	partId: 1,
})

export const AdLibPieces = createAsyncMongoCollection<AdLibPiece>(CollectionName.AdLibPieces)
registerIndex(AdLibPieces, {
	rundownId: 1,
	partId: 1,
	_rank: 1,
})

export const IngestDataCache = createAsyncMongoCollection<IngestDataCacheObj>(CollectionName.IngestDataCache)
registerIndex(IngestDataCache, {
	rundownId: 1,
})

export const PartInstances = createAsyncMongoCollection<PartInstance>(CollectionName.PartInstances)
registerIndex(PartInstances, {
	rundownId: 1,
	playlistActivationId: 1,
	reset: 1,
})
registerIndex(PartInstances, {
	rundownId: 1,
	segmentId: 1,
	takeCount: 1,
	reset: 1,
})
registerIndex(PartInstances, {
	rundownId: 1,
	takeCount: 1,
	reset: 1,
})
registerIndex(PartInstances, {
	rundownId: 1,
	// @ts-expect-error deep property
	'part._id': 1,
	takeCount: 1,
	reset: 1,
})

export const Parts = createAsyncMongoCollection<Part>(CollectionName.Parts)
registerIndex(Parts, {
	rundownId: 1,
	segmentId: 1,
	_rank: 1,
})
registerIndex(Parts, {
	rundownId: 1,
	_rank: 1,
})

export const PieceInstances = createAsyncMongoCollection<PieceInstance>(CollectionName.PieceInstances)
registerIndex(PieceInstances, {
	rundownId: 1,
	partInstanceId: 1,
	reset: -1,
})
registerIndex(PieceInstances, {
	rundownId: 1,
	playlistActivationId: 1,
	partInstanceId: 1,
	reset: -1,
})

export const Pieces = createAsyncMongoCollection<Piece>(CollectionName.Pieces)
registerIndex(Pieces, {
	startRundownId: 1,
	startSegmentId: 1,
	startPartId: 1,
})
registerIndex(Pieces, {
	startRundownId: 1,
	startPartId: 1,
})

export const RundownBaselineAdLibActions = createAsyncMongoCollection<RundownBaselineAdLibAction>(
	CollectionName.RundownBaselineAdLibActions
)
registerIndex(RundownBaselineAdLibActions, {
	rundownId: 1,
})

export const RundownBaselineAdLibPieces = createAsyncMongoCollection<RundownBaselineAdLibItem>(
	CollectionName.RundownBaselineAdLibPieces
)
registerIndex(RundownBaselineAdLibPieces, {
	rundownId: 1,
})

export const RundownBaselineObjs = createAsyncMongoCollection<RundownBaselineObj>(CollectionName.RundownBaselineObjects)
registerIndex(RundownBaselineObjs, {
	rundownId: 1,
})

export const Rundowns = createAsyncMongoCollection<DBRundown>(CollectionName.Rundowns)
registerIndex(Rundowns, {
	playlistId: 1,
})
registerIndex(Rundowns, {
	playlistExternalId: 1,
})

export const RundownPlaylists = createAsyncMongoCollection<DBRundownPlaylist>(CollectionName.RundownPlaylists)
registerIndex(RundownPlaylists, {
	studioId: 1,
	activationId: 1,
})

export const Segments = createAsyncMongoCollection<Segment>(CollectionName.Segments)
registerIndex(Segments, {
	rundownId: 1,
	_rank: 1,
})
