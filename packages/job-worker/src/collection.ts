import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import { BulkWriteOperation, FilterQuery, UpdateQuery } from 'mongodb'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { ExpectedMediaItem } from '@sofie-automation/corelib/dist/dataModel/ExpectedMediaItem'
import { ExpectedPlayoutItem } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { IngestDataCacheObj } from '@sofie-automation/corelib/dist/dataModel/IngestDataCache'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { PeripheralDeviceCommand } from '@sofie-automation/corelib/dist/dataModel/PeripheralDeviceCommand'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { TimelineComplete } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { ExpectedPackageDB } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { PackageInfoDB } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'

// @ts-ignore
export interface FindOptions<T> {
	// TODO
}

export type MongoQuery<TDoc> = FilterQuery<TDoc>
export type MongoModifier<TDoc> = UpdateQuery<TDoc>

export interface ICollection<TDoc extends { _id: ProtectedString<any> }> {
	readonly name: string

	findFetch(selector?: FilterQuery<TDoc> | TDoc['_id'], options?: FindOptions<TDoc>): Promise<Array<TDoc>>
	findOne(selector?: FilterQuery<TDoc> | TDoc['_id'], options?: FindOptions<TDoc>): Promise<TDoc | undefined>
	insert(doc: TDoc | ReadonlyDeep<TDoc>): Promise<TDoc['_id']>
	remove(selector: FilterQuery<TDoc> | TDoc['_id']): Promise<Array<TDoc['_id']>>
	update(selector: FilterQuery<TDoc> | TDoc['_id'], modifier: UpdateQuery<TDoc>): Promise<number>

	/** Returns true if a doc was replace, false if inserted */
	replace(doc: TDoc | ReadonlyDeep<TDoc>): Promise<boolean>

	bulkWrite(ops: Array<BulkWriteOperation<TDoc>>): Promise<unknown>
}

export interface IDirectCollections {
	AdLibActions: ICollection<AdLibAction>
	AdLibPieces: ICollection<AdLibPiece>
	Blueprints: ICollection<Blueprint>
	BucketAdLibActions: ICollection<BucketAdLibAction>
	BucketAdLibPieces: ICollection<BucketAdLib>
	ExpectedMediaItems: ICollection<ExpectedMediaItem>
	ExpectedPlayoutItems: ICollection<ExpectedPlayoutItem>
	IngestDataCache: ICollection<IngestDataCacheObj>
	Parts: ICollection<DBPart>
	PartInstances: ICollection<DBPartInstance>
	PeripheralDevices: ICollection<PeripheralDevice>
	PeripheralDeviceCommands: ICollection<PeripheralDeviceCommand>
	Pieces: ICollection<Piece>
	PieceInstances: ICollection<PieceInstance>
	Rundowns: ICollection<DBRundown>
	RundownBaselineAdLibActions: ICollection<RundownBaselineAdLibAction>
	RundownBaselineAdLibPieces: ICollection<RundownBaselineAdLibItem>
	RundownBaselineObjects: ICollection<RundownBaselineObj>
	RundownPlaylists: ICollection<DBRundownPlaylist>
	Segments: ICollection<DBSegment>
	ShowStyleBases: ICollection<DBShowStyleBase>
	ShowStyleVariants: ICollection<DBShowStyleVariant>
	Studios: ICollection<DBStudio>
	Timelines: ICollection<TimelineComplete>

	ExpectedPackages: ICollection<ExpectedPackageDB>
	PackageInfos: ICollection<PackageInfoDB>
}
