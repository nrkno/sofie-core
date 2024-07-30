/**
 * These collections should be in meteor/client/collections, but are used here in lib.
 * Over time they should be moved across as this is decoupled from server
 */

import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { createSyncReadOnlyMongoCollection } from './lib'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'

export const AdLibActions = createSyncReadOnlyMongoCollection<AdLibAction>(CollectionName.AdLibActions)

export const AdLibPieces = createSyncReadOnlyMongoCollection<AdLibPiece>(CollectionName.AdLibPieces)

export const PartInstances = createSyncReadOnlyMongoCollection<PartInstance>(CollectionName.PartInstances)

export const Parts = createSyncReadOnlyMongoCollection<DBPart>(CollectionName.Parts)

export const RundownBaselineAdLibActions = createSyncReadOnlyMongoCollection<RundownBaselineAdLibAction>(
	CollectionName.RundownBaselineAdLibActions
)

export const RundownBaselineAdLibPieces = createSyncReadOnlyMongoCollection<RundownBaselineAdLibItem>(
	CollectionName.RundownBaselineAdLibPieces
)

export const RundownPlaylists = createSyncReadOnlyMongoCollection<DBRundownPlaylist>(CollectionName.RundownPlaylists)

export const Rundowns = createSyncReadOnlyMongoCollection<DBRundown>(CollectionName.Rundowns)

export const Segments = createSyncReadOnlyMongoCollection<DBSegment>(CollectionName.Segments)
