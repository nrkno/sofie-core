/**
 * These collections should be in meteor/client/collections, but are used here in lib.
 * Over time they should be moved across as this is decoupled from server
 */

import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { createSyncMongoCollection, createSyncReadOnlyMongoCollection } from './lib'
import { DBOrganization } from './Organization'
import { PartInstance } from './PartInstances'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'

export const AdLibActions = createSyncReadOnlyMongoCollection<AdLibAction>(CollectionName.AdLibActions)

export const AdLibPieces = createSyncReadOnlyMongoCollection<AdLibPiece>(CollectionName.AdLibPieces)

export const Organizations = createSyncMongoCollection<DBOrganization>(CollectionName.Organizations)

export const PieceInstances = createSyncReadOnlyMongoCollection<PieceInstance>(CollectionName.PieceInstances)

export const Pieces = createSyncReadOnlyMongoCollection<Piece>(CollectionName.Pieces)

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
