/**
 * These collections should be in meteor/client/collections, but are used here in lib.
 * Over time they should be moved across as this is decoupled from server
 */

import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { AdLibAction } from './AdLibActions'
import { AdLibPiece } from './AdLibPieces'
import { createSyncMongoCollection, createSyncReadOnlyMongoCollection } from './lib'
import { DBOrganization } from './Organization'
import { PartInstance } from './PartInstances'
import { Part } from './Parts'
import { PeripheralDeviceCommand } from './PeripheralDeviceCommands'
import { PieceInstance } from './PieceInstances'
import { Piece } from './Pieces'
import { RundownBaselineAdLibAction } from './RundownBaselineAdLibActions'
import { RundownBaselineAdLibItem } from './RundownBaselineAdLibPieces'
import { DBRundownPlaylist } from './RundownPlaylists'
import { DBRundown } from './Rundowns'
import { Segment } from './Segments'

export const AdLibActions = createSyncReadOnlyMongoCollection<AdLibAction>(CollectionName.AdLibActions)

export const AdLibPieces = createSyncReadOnlyMongoCollection<AdLibPiece>(CollectionName.AdLibPieces)

export const Organizations = createSyncMongoCollection<DBOrganization>(CollectionName.Organizations)

export const PeripheralDeviceCommands = createSyncMongoCollection<PeripheralDeviceCommand>(
	CollectionName.PeripheralDeviceCommands
)

export const PieceInstances = createSyncReadOnlyMongoCollection<PieceInstance>(CollectionName.PieceInstances)

export const Pieces = createSyncReadOnlyMongoCollection<Piece>(CollectionName.Pieces)

export const PartInstances = createSyncReadOnlyMongoCollection<PartInstance>(CollectionName.PartInstances)

export const Parts = createSyncReadOnlyMongoCollection<Part>(CollectionName.Parts)

export const RundownBaselineAdLibActions = createSyncReadOnlyMongoCollection<RundownBaselineAdLibAction>(
	CollectionName.RundownBaselineAdLibActions
)

export const RundownBaselineAdLibPieces = createSyncReadOnlyMongoCollection<RundownBaselineAdLibItem>(
	CollectionName.RundownBaselineAdLibPieces
)

export const RundownPlaylists = createSyncReadOnlyMongoCollection<DBRundownPlaylist>(CollectionName.RundownPlaylists)

export const Rundowns = createSyncReadOnlyMongoCollection<DBRundown>(CollectionName.Rundowns)

export const Segments = createSyncReadOnlyMongoCollection<Segment>(CollectionName.Segments)
