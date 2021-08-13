import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import {
	MongoClient,
	AnyBulkWriteOperation,
	Filter,
	FindOptions,
	UpdateFilter,
	Collection as MongoCollection,
} from 'mongodb'
import { wrapMongoCollection } from './collection'
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
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { ReadonlyDeep } from 'type-fest'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'

export type MongoQuery<TDoc> = Filter<TDoc>
export type MongoModifier<TDoc> = UpdateFilter<TDoc>

export interface ICollection<TDoc extends { _id: ProtectedString<any> }> {
	readonly name: string

	readonly rawCollection: MongoCollection<TDoc>

	findFetch(selector?: MongoQuery<TDoc>, options?: FindOptions<TDoc>): Promise<Array<TDoc>>
	findOne(selector?: MongoQuery<TDoc> | TDoc['_id'], options?: FindOptions<TDoc>): Promise<TDoc | undefined>
	insertOne(doc: TDoc | ReadonlyDeep<TDoc>): Promise<TDoc['_id']>
	// insertMany(docs: Array<TDoc | ReadonlyDeep<TDoc>>): Promise<Array<TDoc['_id']>>
	remove(selector: MongoQuery<TDoc> | TDoc['_id']): Promise<number>
	update(selector: MongoQuery<TDoc> | TDoc['_id'], modifier: MongoModifier<TDoc>): Promise<number>

	/** Returns true if a doc was replaced, false if inserted */
	replace(doc: TDoc | ReadonlyDeep<TDoc>): Promise<boolean>

	bulkWrite(ops: Array<AnyBulkWriteOperation<TDoc>>): Promise<unknown>
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

	ExternalMessageQueue: ICollection<ExternalMessageQueueObj>
}

export function getMongoCollections(client: MongoClient, dbName: string): Readonly<IDirectCollections> {
	const database = client.db(dbName)
	const collections = Object.freeze(
		literal<IDirectCollections>({
			AdLibActions: wrapMongoCollection(database.collection(CollectionName.AdLibActions)),
			AdLibPieces: wrapMongoCollection(database.collection(CollectionName.AdLibPieces)),
			Blueprints: wrapMongoCollection(database.collection(CollectionName.Blueprints)),
			BucketAdLibActions: wrapMongoCollection(database.collection(CollectionName.BucketAdLibActions)),
			BucketAdLibPieces: wrapMongoCollection(database.collection(CollectionName.BucketAdLibPieces)),
			ExpectedMediaItems: wrapMongoCollection(database.collection(CollectionName.ExpectedMediaItems)),
			ExpectedPlayoutItems: wrapMongoCollection(database.collection(CollectionName.ExpectedPlayoutItems)),
			IngestDataCache: wrapMongoCollection(database.collection(CollectionName.IngestDataCache)),
			Parts: wrapMongoCollection(database.collection(CollectionName.Parts)),
			PartInstances: wrapMongoCollection(database.collection(CollectionName.PartInstances)),
			PeripheralDevices: wrapMongoCollection(database.collection(CollectionName.PeripheralDevices)),
			PeripheralDeviceCommands: wrapMongoCollection(database.collection(CollectionName.PeripheralDeviceCommands)),
			Pieces: wrapMongoCollection(database.collection(CollectionName.Pieces)),
			PieceInstances: wrapMongoCollection(database.collection(CollectionName.PieceInstances)),
			Rundowns: wrapMongoCollection(database.collection(CollectionName.Rundowns)),
			RundownBaselineAdLibActions: wrapMongoCollection(
				database.collection(CollectionName.RundownBaselineAdLibActions)
			),
			RundownBaselineAdLibPieces: wrapMongoCollection(
				database.collection(CollectionName.RundownBaselineAdLibPieces)
			),
			RundownBaselineObjects: wrapMongoCollection(database.collection(CollectionName.RundownBaselineObjects)),
			RundownPlaylists: wrapMongoCollection(database.collection(CollectionName.RundownPlaylists)),
			Segments: wrapMongoCollection(database.collection(CollectionName.Segments)),
			ShowStyleBases: wrapMongoCollection(database.collection(CollectionName.ShowStyleBases)),
			ShowStyleVariants: wrapMongoCollection(database.collection(CollectionName.ShowStyleVariants)),
			Studios: wrapMongoCollection(database.collection(CollectionName.Studios)),
			Timelines: wrapMongoCollection(database.collection(CollectionName.Timelines)),

			ExpectedPackages: wrapMongoCollection(database.collection(CollectionName.ExpectedPackages)),
			PackageInfos: wrapMongoCollection(database.collection(CollectionName.PackageInfos)),

			ExternalMessageQueue: wrapMongoCollection(database.collection(CollectionName.ExternalMessageQueue)),
		})
	)
	return collections
}
