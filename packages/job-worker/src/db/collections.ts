import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import {
	MongoClient,
	AnyBulkWriteOperation,
	Filter,
	FindOptions,
	UpdateFilter,
	Collection as MongoCollection,
	ChangeStreamDocument,
	MongoError,
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
import { DBTimelineDatastoreEntry } from '@sofie-automation/corelib/dist/dataModel/TimelineDatastore'
import { ExpectedPackageDB } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { PackageInfoDB } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { getRandomString, literal } from '@sofie-automation/corelib/dist/lib'
import { ReadonlyDeep } from 'type-fest'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { MediaObjects } from '@sofie-automation/corelib/dist/dataModel/MediaObjects'
import EventEmitter = require('eventemitter3')
import { MongoTransaction } from './transaction'
import { logger } from '../logging'

export type MongoQuery<TDoc> = Filter<TDoc>
export type MongoModifier<TDoc> = UpdateFilter<TDoc>

export interface IReadOnlyCollection<TDoc extends { _id: ProtectedString<any> }> {
	readonly name: string

	readonly rawCollection: MongoCollection<TDoc>

	findFetch(
		selector?: MongoQuery<TDoc>,
		options?: FindOptions<TDoc>,
		transaction?: IMongoTransaction | null
	): Promise<Array<TDoc>>
	findOne(
		selector?: MongoQuery<TDoc> | TDoc['_id'],
		options?: FindOptions<TDoc>,
		transaction?: IMongoTransaction | null
	): Promise<TDoc | undefined>

	/**
	 * Watch the collection for changes
	 * This will throw when done in the context of a workqueue job
	 * Note: This is an artificial limitation that could be changed with some thought on how to make sure it doesnt block for too long or leak
	 */
	watch(pipeline: any[]): IChangeStream<TDoc>
}

export interface ICollection<TDoc extends { _id: ProtectedString<any> }> extends IReadOnlyCollection<TDoc> {
	insertOne(doc: TDoc | ReadonlyDeep<TDoc>, transaction: IMongoTransaction | null): Promise<TDoc['_id']>
	// insertMany(docs: Array<TDoc | ReadonlyDeep<TDoc>>): Promise<Array<TDoc['_id']>>
	remove(selector: MongoQuery<TDoc> | TDoc['_id'], transaction: IMongoTransaction | null): Promise<number>
	update(
		selector: MongoQuery<TDoc> | TDoc['_id'],
		modifier: MongoModifier<TDoc>,
		transaction: IMongoTransaction | null
	): Promise<number>

	/** Returns true if a doc was replaced, false if inserted */
	replace(doc: TDoc | ReadonlyDeep<TDoc>, transaction: IMongoTransaction | null): Promise<boolean>

	bulkWrite(ops: Array<AnyBulkWriteOperation<TDoc>>, transaction: IMongoTransaction | null): Promise<unknown>
}

export type IChangeStreamEvents<TDoc extends { _id: ProtectedString<any> }> = {
	error: [e: Error]
	end: []
	change: [doc: ChangeStreamDocument<TDoc>]
}

export interface IChangeStream<TDoc extends { _id: ProtectedString<any> }>
	extends EventEmitter<IChangeStreamEvents<TDoc>> {
	readonly closed: boolean

	close(): Promise<void>
}

export interface IDirectCollections {
	runInTransaction<T>(func: (transaction: IMongoTransaction) => Promise<T>): Promise<T>

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
	PeripheralDevices: IReadOnlyCollection<PeripheralDevice>
	PeripheralDeviceCommands: ICollection<PeripheralDeviceCommand>
	Pieces: ICollection<Piece>
	PieceInstances: ICollection<PieceInstance>
	Rundowns: ICollection<DBRundown>
	RundownBaselineAdLibActions: ICollection<RundownBaselineAdLibAction>
	RundownBaselineAdLibPieces: ICollection<RundownBaselineAdLibItem>
	RundownBaselineObjects: ICollection<RundownBaselineObj>
	RundownPlaylists: ICollection<DBRundownPlaylist>
	Segments: ICollection<DBSegment>
	ShowStyleBases: IReadOnlyCollection<DBShowStyleBase>
	ShowStyleVariants: IReadOnlyCollection<DBShowStyleVariant>
	Studios: ICollection<DBStudio>
	Timelines: ICollection<TimelineComplete>
	TimelineDatastores: ICollection<DBTimelineDatastoreEntry>

	ExpectedPackages: ICollection<ExpectedPackageDB>
	PackageInfos: IReadOnlyCollection<PackageInfoDB>

	ExternalMessageQueue: ICollection<ExternalMessageQueueObj>

	MediaObjects: IReadOnlyCollection<MediaObjects>
}

/**
 * Represents a MongoDB session and transaction
 */
export interface IMongoTransaction {
	/**
	 * A random id for this transaction
	 */
	readonly id: string
}

/**
 * Get the wrapped mongo db collections
 * @param client MongoClient handle
 * @param dbName Name of the mongodb database
 * @param allowWatchers Whether watch operations are supported. See ICollection.watch for more information
 */
export function getMongoCollections(
	client: MongoClient,
	dbName: string,
	allowWatchers: boolean
): Readonly<IDirectCollections> {
	const database = client.db(dbName)

	const runInTransaction = async <T>(func: (transaction: IMongoTransaction) => Promise<T>): Promise<T> => {
		const session = client.startSession()
		const id = getRandomString()
		try {
			session.startTransaction({
				// TODO - review/refine
				readConcern: { level: 'snapshot' },
				writeConcern: { w: 'majority' },
				readPreference: 'primary',
			})

			const transaction = new MongoTransaction(session, id)
			logger.silly(`Starting MongoDB Transaction: ${id}`)

			const res = await func(transaction)

			await session.commitTransaction()

			return res
		} catch (error) {
			if (error instanceof MongoError && error.hasErrorLabel('UnknownTransactionCommitResult')) {
				// Future: Some retry logic
			} else if (error instanceof MongoError && error.hasErrorLabel('TransientTransactionError')) {
				// Future: Some retry logic
			}

			logger.silly(`Aborted MongoDB Transaction: ${id}`)
			await session.abortTransaction()

			throw error
		} finally {
			await session.endSession()
			logger.silly(`Completed MongoDB Transaction: ${id}`)
		}
	}

	return Object.freeze(
		literal<IDirectCollections>({
			runInTransaction,

			AdLibActions: wrapMongoCollection(database.collection(CollectionName.AdLibActions), allowWatchers),
			AdLibPieces: wrapMongoCollection(database.collection(CollectionName.AdLibPieces), allowWatchers),
			Blueprints: wrapMongoCollection(database.collection(CollectionName.Blueprints), allowWatchers),
			BucketAdLibActions: wrapMongoCollection(
				database.collection(CollectionName.BucketAdLibActions),
				allowWatchers
			),
			BucketAdLibPieces: wrapMongoCollection(
				database.collection(CollectionName.BucketAdLibPieces),
				allowWatchers
			),
			ExpectedMediaItems: wrapMongoCollection(
				database.collection(CollectionName.ExpectedMediaItems),
				allowWatchers
			),
			ExpectedPlayoutItems: wrapMongoCollection(
				database.collection(CollectionName.ExpectedPlayoutItems),
				allowWatchers
			),
			IngestDataCache: wrapMongoCollection(database.collection(CollectionName.IngestDataCache), allowWatchers),
			Parts: wrapMongoCollection(database.collection(CollectionName.Parts), allowWatchers),
			PartInstances: wrapMongoCollection(database.collection(CollectionName.PartInstances), allowWatchers),
			PeripheralDevices: wrapMongoCollection(
				database.collection(CollectionName.PeripheralDevices),
				allowWatchers
			),
			PeripheralDeviceCommands: wrapMongoCollection(
				database.collection(CollectionName.PeripheralDeviceCommands),
				allowWatchers
			),
			Pieces: wrapMongoCollection(database.collection(CollectionName.Pieces), allowWatchers),
			PieceInstances: wrapMongoCollection(database.collection(CollectionName.PieceInstances), allowWatchers),
			Rundowns: wrapMongoCollection(database.collection(CollectionName.Rundowns), allowWatchers),
			RundownBaselineAdLibActions: wrapMongoCollection(
				database.collection(CollectionName.RundownBaselineAdLibActions),
				allowWatchers
			),
			RundownBaselineAdLibPieces: wrapMongoCollection(
				database.collection(CollectionName.RundownBaselineAdLibPieces),
				allowWatchers
			),
			RundownBaselineObjects: wrapMongoCollection(
				database.collection(CollectionName.RundownBaselineObjects),
				allowWatchers
			),
			RundownPlaylists: wrapMongoCollection(database.collection(CollectionName.RundownPlaylists), allowWatchers),
			Segments: wrapMongoCollection(database.collection(CollectionName.Segments), allowWatchers),
			ShowStyleBases: wrapMongoCollection(database.collection(CollectionName.ShowStyleBases), allowWatchers),
			ShowStyleVariants: wrapMongoCollection(
				database.collection(CollectionName.ShowStyleVariants),
				allowWatchers
			),
			Studios: wrapMongoCollection(database.collection(CollectionName.Studios), allowWatchers),
			Timelines: wrapMongoCollection(database.collection(CollectionName.Timelines), allowWatchers),
			TimelineDatastores: wrapMongoCollection(
				database.collection(CollectionName.TimelineDatastore),
				allowWatchers
			),

			ExpectedPackages: wrapMongoCollection(database.collection(CollectionName.ExpectedPackages), allowWatchers),
			PackageInfos: wrapMongoCollection(database.collection(CollectionName.PackageInfos), allowWatchers),

			ExternalMessageQueue: wrapMongoCollection(
				database.collection(CollectionName.ExternalMessageQueue),
				allowWatchers
			),

			MediaObjects: wrapMongoCollection(database.collection(CollectionName.MediaObjects), allowWatchers),
		})
	)
}
