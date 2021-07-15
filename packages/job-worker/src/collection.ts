import { ProtectedString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import { AnyBulkWriteOperation, Collection as MongoCollection, Filter, FindOptions, UpdateFilter } from 'mongodb'
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
import { startSpanManual } from './profiler'

// // @ts-ignore
// export interface FindOptions<T> {
// 	// TODO
// }

export type MongoQuery<TDoc> = Filter<TDoc>
export type MongoModifier<TDoc> = UpdateFilter<TDoc>

export interface ICollection<TDoc extends { _id: ProtectedString<any> }> {
	readonly name: string

	findFetch(selector?: MongoQuery<TDoc>, options?: FindOptions<TDoc>): Promise<Array<TDoc>>
	findOne(selector?: MongoQuery<TDoc> | TDoc['_id'], options?: FindOptions<TDoc>): Promise<TDoc | undefined>
	insertOne(doc: TDoc | ReadonlyDeep<TDoc>): Promise<TDoc['_id']>
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
}

/** This is for the mock mongo collection, as internally it is sync and so we dont need or want to play around with fibers */
class WrappedCollection<TDoc extends { _id: ProtectedString<any> }> implements ICollection<TDoc> {
	readonly #collection: MongoCollection<TDoc>

	constructor(collection: MongoCollection<TDoc>) {
		this.#collection = collection
	}

	get name(): string {
		return this.#collection.collectionName
	}

	async findFetch(selector: MongoQuery<TDoc>, options?: FindOptions<TDoc>): Promise<Array<TDoc>> {
		const span = startSpanManual('WrappedCollection.findFetch')
		if (span) {
			span.addLabels({
				collection: this.name,
				query: JSON.stringify(selector),
			})
		}
		const res = await this.#collection.find(selector as any, options).toArray()
		if (span) span.end()
		return res
	}

	async findOne(selector: MongoQuery<TDoc> | TDoc['_id'], options?: FindOptions<TDoc>): Promise<TDoc | undefined> {
		const span = startSpanManual('WrappedCollection.findOne')
		if (span) {
			span.addLabels({
				collection: this.name,
				query: JSON.stringify(selector),
			})
		}

		if (typeof selector === 'string') {
			selector = { _id: selector }
		}
		const res = await this.#collection.findOne(selector, options)
		if (span) span.end()
		return res
	}

	async insertOne(doc: TDoc): Promise<TDoc['_id']> {
		const span = startSpanManual('WrappedCollection.insertOne')
		if (span) {
			span.addLabels({
				collection: this.name,
				id: unprotectString(doc._id),
			})
		}

		// TODO - fill in id if missing?
		const res = await this.#collection.insertOne(doc as any)
		if (span) span.end()
		return res.insertedId
	}

	async replace(doc: TDoc): Promise<boolean> {
		const span = startSpanManual('WrappedCollection.replace')
		if (span) {
			span.addLabels({
				collection: this.name,
				id: unprotectString(doc._id),
			})
		}

		const res = await this.#collection.replaceOne({ _id: doc._id }, doc)
		if (span) span.end()
		return res.matchedCount > 0
	}

	// async insertMany(docs: TDoc[]): Promise<Array<TDoc['_id']>> {
	// 	const res = await this.#collection.insertMany(docs as any)
	// 	return res.insertedIds
	// }

	async update(
		selector: MongoQuery<TDoc> | TDoc['_id'],
		modifier: MongoModifier<TDoc>
		// options?: UpdateOptions
	): Promise<number> {
		const span = startSpanManual('WrappedCollection.update')
		if (span) {
			span.addLabels({
				collection: this.name,
				query: JSON.stringify(selector),
			})
		}

		if (typeof selector === 'string') {
			selector = { _id: selector }
		}

		const res = await this.#collection.updateMany(selector, modifier)
		if (span) span.end()
		return res.upsertedCount
	}

	async remove(selector: MongoQuery<TDoc> | TDoc['_id']): Promise<number> {
		const span = startSpanManual('WrappedCollection.remove')
		if (span) {
			span.addLabels({
				collection: this.name,
				query: JSON.stringify(selector),
			})
		}

		if (typeof selector === 'string') {
			selector = { _id: selector }
		}

		const res = await this.#collection.deleteMany(selector)
		if (span) span.end()
		return res.deletedCount
	}

	async bulkWrite(ops: Array<AnyBulkWriteOperation<TDoc>>): Promise<void> {
		const span = startSpanManual('WrappedCollection.bulkWrite')
		if (span) {
			span.addLabels({
				collection: this.name,
				opCount: ops.length,
			})
		}

		if (ops.length > 0) {
			const bulkWriteResult = await this.#collection.bulkWrite(ops, {
				ordered: false,
			})
			if (
				bulkWriteResult &&
				Array.isArray(bulkWriteResult.result?.writeErrors) &&
				bulkWriteResult.result.writeErrors.length
			) {
				throw new Error(`Errors in rawCollection.bulkWrite: ${bulkWriteResult.result.writeErrors.join(',')}`)
			}
		}

		if (span) span.end()
	}
}

export function wrapMongoCollection<TDoc extends { _id: ProtectedString<any> }>(
	rawCollection: MongoCollection<TDoc>
): ICollection<TDoc> {
	return new WrappedCollection(rawCollection)
}
