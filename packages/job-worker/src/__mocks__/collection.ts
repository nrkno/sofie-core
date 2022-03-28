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
import { TimelineComplete } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { clone, literal } from '@sofie-automation/corelib/dist/lib'
import {
	mongoFindOptions,
	mongoModify,
	mongoWhere,
	FindOptions as CacheFindOptions,
} from '@sofie-automation/corelib/dist/mongo'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { Collection, FindOptions, AnyBulkWriteOperation } from 'mongodb'
import { ReadonlyDeep } from 'type-fest'
import _ = require('underscore')
import { ICollection, IDirectCollections, MongoModifier, MongoQuery } from '../db'

export interface CollectionOperation {
	type: string
	args: any[]
}

export class MockMongoCollection<TDoc extends { _id: ProtectedString<any> }> implements ICollection<TDoc> {
	readonly #name: string
	readonly #documents = new Map<TDoc['_id'], TDoc>()
	readonly #ops: CollectionOperation[] = []

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

	clearOpLog(): void {
		this.#ops.length = 0
	}

	async findFetch(selector?: MongoQuery<TDoc>, options?: FindOptions<TDoc>): Promise<TDoc[]> {
		this.#ops.push({ type: 'findFetch', args: [selector, options] })

		return this.findFetchInner(selector, options)
	}

	private async findFetchInner(selector?: MongoQuery<TDoc>, options?: FindOptions<TDoc>): Promise<TDoc[]> {
		if (typeof selector === 'string') selector = { _id: selector }
		selector = selector ?? {}

		const unimplementedUsedOptions = _.without(_.keys(options), 'sort', 'limit', 'projection')
		if (unimplementedUsedOptions.length > 0) {
			throw new Error(`find being performed using unimplemented options: ${unimplementedUsedOptions}`)
		}

		let matchedDocs: TDoc[]
		if (typeof selector._id === 'string') {
			const doc = this.#documents.get(selector._id as any)
			if (doc && mongoWhere(doc, selector)) {
				matchedDocs = [doc]
			} else {
				matchedDocs = []
			}
		} else {
			matchedDocs = Array.from(this.#documents.values()).filter((doc) => mongoWhere(doc, selector))
		}

		if (options) {
			let fields: CacheFindOptions<TDoc>['fields']
			if (options.projection) {
				const fields2: any = (fields = {})

				for (const [k, v] of Object.entries(options.projection)) {
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
				for (const [k, v] of Object.entries(options.sort)) {
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
	async findOne(selector?: MongoQuery<TDoc> | TDoc['_id'], options?: FindOptions<TDoc>): Promise<TDoc | undefined> {
		this.#ops.push({ type: 'findOne', args: [selector, options] })

		const docs = await this.findFetchInner(selector, {
			...options,
			limit: 1,
		})
		return docs[0]
	}
	async insertOne(doc: TDoc | ReadonlyDeep<TDoc>): Promise<TDoc['_id']> {
		this.#ops.push({ type: 'insertOne', args: [doc._id] })

		if (!doc._id) throw new Error(`insertOne requires document to have an _id`)

		if (this.#documents.has(doc._id)) throw new Error(`insertOne document already exists`)

		this.#documents.set(doc._id, clone(doc))

		return doc._id
	}
	async remove(selector: MongoQuery<TDoc> | TDoc['_id']): Promise<number> {
		this.#ops.push({ type: 'remove', args: [selector] })

		return this.removeInner(selector)
	}
	private async removeInner(selector: MongoQuery<TDoc> | TDoc['_id']): Promise<number> {
		const docs: Pick<TDoc, '_id'>[] = await this.findFetchInner(selector, { projection: { _id: 1 } })
		for (const doc of docs) {
			this.#documents.delete(doc._id)
		}

		return docs.length
	}
	async update(selector: MongoQuery<TDoc> | TDoc['_id'], modifier: MongoModifier<TDoc>): Promise<number> {
		this.#ops.push({ type: 'update', args: [selector, modifier] })

		return this.updateInner(selector, modifier, false)
	}
	private async updateInner(
		selector: MongoQuery<TDoc> | TDoc['_id'],
		modifier: MongoModifier<TDoc>,
		single: boolean
	) {
		const docs = await this.findFetchInner(selector)

		for (const doc of docs) {
			const newDoc = mongoModify(selector, doc, modifier)
			this.#documents.set(doc._id, newDoc)

			// For an 'updateOne
			if (single) break
		}

		return docs.length
	}
	async replace(doc: TDoc | ReadonlyDeep<TDoc>): Promise<boolean> {
		this.#ops.push({ type: 'replace', args: [doc._id] })

		return this.replaceInner(doc)
	}
	private async replaceInner(doc: TDoc | ReadonlyDeep<TDoc>): Promise<boolean> {
		if (!doc._id) throw new Error(`replace requires document to have an _id`)

		const exists = this.#documents.has(doc._id)
		this.#documents.set(doc._id, clone(doc))
		return exists
	}
	async bulkWrite(ops: AnyBulkWriteOperation<TDoc>[]): Promise<unknown> {
		this.#ops.push({ type: 'bulkWrite', args: [ops.length] })

		for (const op of ops) {
			if ('updateMany' in op) {
				await this.updateInner(op.updateMany.filter, op.updateMany.update, false)
			} else if ('updateOne' in op) {
				await this.updateInner(op.updateOne.filter, op.updateOne.update, true)
			} else if ('replaceOne' in op) {
				await this.replaceInner(op.replaceOne.replacement as any)
			} else if ('deleteMany' in op) {
				await this.removeInner(op.deleteMany.filter)
			} else {
				// Note: implement more as we start using them
				throw new Error(`Unknown mongo Bulk Operation: ${JSON.stringify(op)}`)
			}
		}

		return null
	}
}

export function getMockCollections(): Readonly<IDirectCollections> {
	const collections = Object.freeze(
		literal<IDirectCollections>({
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

			ExpectedPackages: new MockMongoCollection<ExpectedPackageDB>(CollectionName.ExpectedPackages),
			PackageInfos: new MockMongoCollection(CollectionName.PackageInfos),

			ExternalMessageQueue: new MockMongoCollection(CollectionName.ExternalMessageQueue),
		})
	)
	return collections
}
