import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { ExpectedPackageDB } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
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
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { DBTimelineDatastoreEntry } from '@sofie-automation/corelib/dist/dataModel/TimelineDatastore'
import { TimelineComplete } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { clone, getRandomString, literal } from '@sofie-automation/corelib/dist/lib'
import {
	FindOptions as CacheFindOptions,
	mongoFindOptions,
	mongoModify,
	mongoWhere,
} from '@sofie-automation/corelib/dist/mongo'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import EventEmitter = require('eventemitter3')
import { AnyBulkWriteOperation, Collection, FindOptions } from 'mongodb'
import { ReadonlyDeep } from 'type-fest'
import {
	IChangeStream,
	IChangeStreamEvents,
	ICollection,
	IDirectCollections,
	IMongoTransaction,
	MongoModifier,
	MongoQuery,
} from '../db'
import _ = require('underscore')
import { ExpectedMediaItem } from '@sofie-automation/corelib/dist/dataModel/ExpectedMediaItem'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { MediaObjects } from '@sofie-automation/corelib/dist/dataModel/MediaObjects'
import { PackageInfoDB } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'

export interface CollectionOperation {
	type: string
	args: any[]
}

export class MockMongoCollection<TDoc extends { _id: ProtectedString<any> }> implements ICollection<TDoc> {
	readonly #name: string
	#documents = new Map<TDoc['_id'], TDoc>()
	readonly #ops: CollectionOperation[] = []

	#transactionState:
		| {
				pendingDocuments: Map<TDoc['_id'], TDoc>
				transaction: MockMongoTransaction
		  }
		| undefined

	/** Allow watchers to be created on this collection */
	allowWatchers = false

	static fromReal<TDoc extends { _id: ProtectedString<any> }>(col: ICollection<TDoc>): MockMongoCollection<TDoc> {
		// TODO - any type assertion?
		return col as any as MockMongoCollection<TDoc>
	}

	constructor(name: CollectionName) {
		this.#name = name
	}

	get name(): string {
		return this.#name
	}
	get rawCollection(): Collection<TDoc> {
		throw new Error('Not implemented.')
	}

	get operations(): CollectionOperation[] {
		return this.#ops
	}

	#getCurrentDocuments(transaction: IMongoTransaction | null | undefined): Map<TDoc['_id'], TDoc> {
		if (this.#transactionState) {
			if (transaction === undefined) {
				// This means that the query didn't provide any kind of transaction, so we don't know whether it was trying to get the transaction or ignore it.
				// For testing purposes, we reject this query and require either a transaction or null to be provided to make the intent clear.
				throw new Error('Cannot use `undefined` as transaction when a transaction is active')
			} else if (transaction === null) {
				return this.#documents
			} else if (transaction !== this.#transactionState.transaction) {
				throw new Error('Got a query with an unknown (stale?) transaction')
			} else {
				return this.#transactionState.pendingDocuments
			}
		} else {
			if (transaction) {
				throw new Error('Got a query with an unknown (stale?) transaction')
			} else {
				return this.#documents
			}
		}
	}

	clearOpLog(): void {
		this.#ops.length = 0
	}

	startTransaction(transaction: MockMongoTransaction): void {
		if (this.allowWatchers) throw new Error('Watchers and transactions not supported concurrently')

		if (this.#transactionState) throw new Error('A transaction is already setup')

		const newDocs = new Map<TDoc['_id'], TDoc>()
		for (const [docId, doc] of this.#documents) {
			newDocs.set(docId, clone(doc))
		}

		this.#transactionState = {
			pendingDocuments: newDocs,
			transaction,
		}
	}

	abortTransaction(): void {
		this.#transactionState = undefined
	}
	commitTransaction(): void {
		if (!this.#transactionState) throw new Error('A transaction is not setup')
		this.#documents = this.#transactionState.pendingDocuments
		this.#transactionState = undefined
	}

	async findFetch(
		selector?: MongoQuery<TDoc>,
		options?: FindOptions<TDoc>,
		transaction?: IMongoTransaction | null
	): Promise<TDoc[]> {
		this.#ops.push({ type: 'findFetch', args: [selector, options] })

		const currentDocuments = this.#getCurrentDocuments(transaction)

		return this.findFetchInner(currentDocuments, selector, options)
	}

	private async findFetchInner(
		currentDocuments: Map<TDoc['_id'], TDoc>,
		selector: MongoQuery<TDoc> | undefined,
		options: FindOptions<TDoc> | undefined
	): Promise<TDoc[]> {
		if (typeof selector === 'string') selector = { _id: selector }
		selector = selector ?? {}

		const unimplementedUsedOptions = _.without(_.keys(options), 'sort', 'limit', 'projection')
		if (unimplementedUsedOptions.length > 0) {
			throw new Error(`find being performed using unimplemented options: ${unimplementedUsedOptions}`)
		}

		let matchedDocs: TDoc[]
		if (typeof selector._id === 'string') {
			const doc = currentDocuments.get(selector._id as any)
			if (doc && mongoWhere(doc, selector)) {
				matchedDocs = [doc]
			} else {
				matchedDocs = []
			}
		} else {
			matchedDocs = Array.from(currentDocuments.values()).filter((doc) => mongoWhere(doc, selector as any))
		}

		if (options) {
			let fields: CacheFindOptions<TDoc>['fields']
			if (options.projection) {
				const fields2: any = (fields = {})

				for (const [k, v] of Object.entries<any>(options.projection)) {
					if (v === 0 || v === false) {
						fields2[k] = 0
					} else if (v === 1 || v === true) {
						fields2[k] = 1
					} else {
						throw new Error(`find has invalid value for projection "${k}":"${v}"`)
					}
				}
			}

			let sort: CacheFindOptions<TDoc>['sort']
			if (options.sort) {
				const sort2: any = (sort = {})
				if (typeof options.sort !== 'object') throw new Error(`find expects sort to be an object (for now)`)
				for (const [k, v] of Object.entries<any>(options.sort)) {
					if (v === 1 || v === -1) {
						sort2[k] = v
					} else {
						throw new Error(`find expects an sort value to be an int "${k}":"${v}" (for now)`)
					}
				}
			}

			matchedDocs = mongoFindOptions(matchedDocs, {
				sort: sort,
				limit: options.limit,
				skip: options.skip,
				fields: fields,
			})
		}

		return clone(matchedDocs)
	}
	async findOne(
		selector?: MongoQuery<TDoc> | TDoc['_id'],
		options?: FindOptions<TDoc>,
		transaction?: IMongoTransaction | null
	): Promise<TDoc | undefined> {
		this.#ops.push({ type: 'findOne', args: [selector, options] })

		const currentDocuments = this.#getCurrentDocuments(transaction)

		const docs = await this.findFetchInner(currentDocuments, selector, {
			...options,
			limit: 1,
		})
		return docs[0]
	}
	async insertOne(doc: TDoc | ReadonlyDeep<TDoc>, transaction?: IMongoTransaction | null): Promise<TDoc['_id']> {
		this.#ops.push({ type: 'insertOne', args: [doc._id] })

		if (!doc._id) throw new Error(`insertOne requires document to have an _id`)

		const currentDocuments = this.#getCurrentDocuments(transaction)

		if (currentDocuments.has(doc._id)) throw new Error(`insertOne document already exists`)

		currentDocuments.set(doc._id, clone(doc))

		return doc._id
	}
	async remove(selector: MongoQuery<TDoc> | TDoc['_id'], transaction?: IMongoTransaction | null): Promise<number> {
		this.#ops.push({ type: 'remove', args: [selector] })

		const currentDocuments = this.#getCurrentDocuments(transaction)

		return this.removeInner(currentDocuments, selector)
	}
	private async removeInner(
		currentDocuments: Map<TDoc['_id'], TDoc>,
		selector: MongoQuery<TDoc> | TDoc['_id']
	): Promise<number> {
		const docs: Pick<TDoc, '_id'>[] = await this.findFetchInner(currentDocuments, selector, {
			projection: { _id: 1 },
		})
		for (const doc of docs) {
			currentDocuments.delete(doc._id)
		}

		return docs.length
	}
	async update(
		selector: MongoQuery<TDoc> | TDoc['_id'],
		modifier: MongoModifier<TDoc>,
		transaction?: IMongoTransaction | null
	): Promise<number> {
		this.#ops.push({ type: 'update', args: [selector, modifier] })

		const currentDocuments = this.#getCurrentDocuments(transaction)

		return this.updateInner(currentDocuments, selector, modifier, false)
	}
	private async updateInner(
		currentDocuments: Map<TDoc['_id'], TDoc>,
		selector: MongoQuery<TDoc> | TDoc['_id'],
		modifier: MongoModifier<TDoc>,
		single: boolean
	) {
		const docs = await this.findFetchInner(currentDocuments, selector, undefined)

		for (const doc of docs) {
			const newDoc = mongoModify(selector, doc, modifier)
			currentDocuments.set(doc._id, newDoc)

			// For an 'updateOne
			if (single) break
		}

		return docs.length
	}
	async replace(doc: TDoc | ReadonlyDeep<TDoc>, transaction?: IMongoTransaction | null): Promise<boolean> {
		this.#ops.push({ type: 'replace', args: [doc._id] })

		const currentDocuments = this.#getCurrentDocuments(transaction)

		return this.replaceInner(currentDocuments, doc)
	}
	private async replaceInner(
		currentDocuments: Map<TDoc['_id'], TDoc>,
		doc: TDoc | ReadonlyDeep<TDoc>
	): Promise<boolean> {
		if (!doc._id) throw new Error(`replace requires document to have an _id`)

		const exists = currentDocuments.has(doc._id)
		currentDocuments.set(doc._id, clone(doc))
		return exists
	}
	async bulkWrite(ops: AnyBulkWriteOperation<TDoc>[], transaction?: IMongoTransaction | null): Promise<unknown> {
		this.#ops.push({ type: 'bulkWrite', args: [ops.length] })

		const currentDocuments = this.#getCurrentDocuments(transaction)

		for (const op of ops) {
			if ('updateMany' in op) {
				await this.updateInner(currentDocuments, op.updateMany.filter, op.updateMany.update, false)
			} else if ('updateOne' in op) {
				await this.updateInner(currentDocuments, op.updateOne.filter, op.updateOne.update, true)
			} else if ('replaceOne' in op) {
				await this.replaceInner(currentDocuments, op.replaceOne.replacement as any)
			} else if ('deleteMany' in op) {
				await this.removeInner(currentDocuments, op.deleteMany.filter)
			} else {
				// Note: implement more as we start using them
				throw new Error(`Unknown mongo Bulk Operation: ${JSON.stringify(op)}`)
			}
		}

		return null
	}

	/**
	 * The registered watchers
	 * Note: These are not (yet?) automatically triggered upon changes
	 */
	watchers: MockChangeStream<TDoc>[] = []

	watch(pipeline: any[]): IChangeStream<TDoc> {
		if (!this.allowWatchers) throw new Error(`Watching this collection is not allowed`)

		const newWatcher = new MockChangeStream(pipeline)
		this.watchers.push(newWatcher)

		return newWatcher
	}
}

export class MockChangeStream<TDoc extends { _id: ProtectedString<any> }>
	extends EventEmitter<IChangeStreamEvents<TDoc>>
	implements IChangeStream<TDoc>
{
	constructor(public readonly pipeline: any[]) {
		super()
	}

	closed = false

	async close(): Promise<void> {
		await defer()
		this.closed = true
	}
}

export async function defer(): Promise<void> {
	return new Promise((resolve) => jest.requireActual('timers').setImmediate(resolve))
}

export class MockMongoTransaction implements IMongoTransaction {
	#id: string

	get id(): string {
		return this.#id
	}

	constructor() {
		this.#id = getRandomString()
	}
}

export function getMockCollections(): {
	jobCollections: Readonly<IDirectCollections>
	mockCollections: Readonly<IMockCollections>
} {
	let currentTransaction: MockMongoTransaction | undefined

	const runInTransaction = async <T>(func: (transaction: IMongoTransaction) => Promise<T>): Promise<T> => {
		if (currentTransaction) throw new Error('A mongodb transaction is already running!')

		// We just need enough to satisfy the transaction types
		const transaction = new MockMongoTransaction()
		currentTransaction = transaction

		for (const collection of allMockCollections) {
			collection.startTransaction(currentTransaction)
		}

		try {
			const res = await func(transaction)

			for (const collection of allMockCollections) {
				collection.commitTransaction()
			}

			return res
		} catch (e) {
			// Discard pending changes

			for (const collection of allMockCollections) {
				collection.abortTransaction()
			}

			throw e
		} finally {
			currentTransaction = undefined
		}
	}

	const mockCollections: IMockCollections = Object.freeze(
		literal<IMockCollections>({
			AdLibActions: new MockMongoCollection<AdLibAction>(CollectionName.AdLibActions),
			AdLibPieces: new MockMongoCollection<AdLibPiece>(CollectionName.AdLibPieces),
			Blueprints: new MockMongoCollection<Blueprint>(CollectionName.Blueprints),
			BucketAdLibActions: new MockMongoCollection<BucketAdLibAction>(CollectionName.BucketAdLibActions),
			BucketAdLibPieces: new MockMongoCollection<BucketAdLib>(CollectionName.BucketAdLibPieces),
			ExpectedMediaItems: new MockMongoCollection(CollectionName.ExpectedMediaItems),
			ExpectedPlayoutItems: new MockMongoCollection<ExpectedPlayoutItem>(CollectionName.ExpectedPlayoutItems),
			IngestDataCache: new MockMongoCollection<IngestDataCacheObj>(CollectionName.IngestDataCache),
			Parts: new MockMongoCollection<DBPart>(CollectionName.Parts),
			PartInstances: new MockMongoCollection<DBPartInstance>(CollectionName.PartInstances),
			PeripheralDevices: new MockMongoCollection<PeripheralDevice>(CollectionName.PeripheralDevices),
			PeripheralDeviceCommands: new MockMongoCollection<PeripheralDeviceCommand>(
				CollectionName.PeripheralDeviceCommands
			),
			Pieces: new MockMongoCollection<Piece>(CollectionName.Pieces),
			PieceInstances: new MockMongoCollection<PieceInstance>(CollectionName.PieceInstances),
			Rundowns: new MockMongoCollection<DBRundown>(CollectionName.Rundowns),
			RundownBaselineAdLibActions: new MockMongoCollection<RundownBaselineAdLibAction>(
				CollectionName.RundownBaselineAdLibActions
			),
			RundownBaselineAdLibPieces: new MockMongoCollection<AdLibPiece>(CollectionName.RundownBaselineAdLibPieces),
			RundownBaselineObjects: new MockMongoCollection<RundownBaselineObj>(CollectionName.RundownBaselineObjects),
			RundownPlaylists: new MockMongoCollection<DBRundownPlaylist>(CollectionName.RundownPlaylists),
			Segments: new MockMongoCollection<DBSegment>(CollectionName.Segments),
			ShowStyleBases: new MockMongoCollection<DBShowStyleBase>(CollectionName.ShowStyleBases),
			ShowStyleVariants: new MockMongoCollection<DBShowStyleVariant>(CollectionName.ShowStyleVariants),
			Studios: new MockMongoCollection<DBStudio>(CollectionName.Studios),
			Timelines: new MockMongoCollection<TimelineComplete>(CollectionName.Timelines),
			TimelineDatastores: new MockMongoCollection<DBTimelineDatastoreEntry>(CollectionName.TimelineDatastore),

			ExpectedPackages: new MockMongoCollection<ExpectedPackageDB>(CollectionName.ExpectedPackages),
			PackageInfos: new MockMongoCollection(CollectionName.PackageInfos),

			ExternalMessageQueue: new MockMongoCollection(CollectionName.ExternalMessageQueue),

			MediaObjects: new MockMongoCollection(CollectionName.MediaObjects),
		})
	)
	const allMockCollections: MockMongoCollection<any>[] = []
	for (const [id, collection] of Object.entries<any>(mockCollections)) {
		if (id === 'ShowStyleBases' || id === 'ShowStyleVariants' || id === 'MediaObjects' || id === 'Studios') {
			// Readonly collections, they don't need a transaction
			continue
		} else if (collection instanceof MockMongoCollection<any>) {
			allMockCollections.push(collection)
		}
	}

	const jobCollections = Object.freeze(
		literal<IDirectCollections>({
			runInTransaction,
			...mockCollections,
		})
	)

	return {
		jobCollections,
		mockCollections,
	}
}

/**
 * A version of IDirectCollections, with every collection swapped out for MockMongoCollection.
 * This gives us mutable versions of readonly collections, and avoids the need to provide a `transaction` parameter
 */
export interface IMockCollections {
	AdLibActions: MockMongoCollection<AdLibAction>
	AdLibPieces: MockMongoCollection<AdLibPiece>
	Blueprints: MockMongoCollection<Blueprint>
	BucketAdLibActions: MockMongoCollection<BucketAdLibAction>
	BucketAdLibPieces: MockMongoCollection<BucketAdLib>
	ExpectedMediaItems: MockMongoCollection<ExpectedMediaItem>
	ExpectedPlayoutItems: MockMongoCollection<ExpectedPlayoutItem>
	IngestDataCache: MockMongoCollection<IngestDataCacheObj>
	Parts: MockMongoCollection<DBPart>
	PartInstances: MockMongoCollection<DBPartInstance>
	PeripheralDevices: MockMongoCollection<PeripheralDevice>
	PeripheralDeviceCommands: MockMongoCollection<PeripheralDeviceCommand>
	Pieces: MockMongoCollection<Piece>
	PieceInstances: MockMongoCollection<PieceInstance>
	Rundowns: MockMongoCollection<DBRundown>
	RundownBaselineAdLibActions: MockMongoCollection<RundownBaselineAdLibAction>
	RundownBaselineAdLibPieces: MockMongoCollection<RundownBaselineAdLibItem>
	RundownBaselineObjects: MockMongoCollection<RundownBaselineObj>
	RundownPlaylists: MockMongoCollection<DBRundownPlaylist>
	Segments: MockMongoCollection<DBSegment>
	ShowStyleBases: MockMongoCollection<DBShowStyleBase>
	ShowStyleVariants: MockMongoCollection<DBShowStyleVariant>
	Studios: MockMongoCollection<DBStudio>
	Timelines: MockMongoCollection<TimelineComplete>
	TimelineDatastores: MockMongoCollection<DBTimelineDatastoreEntry>

	ExpectedPackages: MockMongoCollection<ExpectedPackageDB>
	PackageInfos: MockMongoCollection<PackageInfoDB>

	ExternalMessageQueue: MockMongoCollection<ExternalMessageQueueObj>

	MediaObjects: MockMongoCollection<MediaObjects>
}
