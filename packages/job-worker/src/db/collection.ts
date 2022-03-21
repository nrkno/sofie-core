import { ProtectedString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { AnyBulkWriteOperation, Collection as MongoCollection, FindOptions } from 'mongodb'
import { startSpanManual } from '../profiler'
import { ICollection, MongoModifier, MongoQuery } from './collections'

/** Wrap some APM and better error small query modifications around a Mongo.Collection */
class WrappedCollection<TDoc extends { _id: ProtectedString<any> }> implements ICollection<TDoc> {
	readonly #collection: MongoCollection<TDoc>

	constructor(collection: MongoCollection<TDoc>) {
		this.#collection = collection
	}

	get name(): string {
		return this.#collection.collectionName
	}

	get rawCollection(): MongoCollection<TDoc> {
		return this.#collection
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
		return res as any
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
		return res ?? undefined
	}

	async insertOne(doc: TDoc): Promise<TDoc['_id']> {
		const span = startSpanManual('WrappedCollection.insertOne')
		if (span) {
			span.addLabels({
				collection: this.name,
				id: unprotectString(doc._id),
			})
		}

		const res = await this.#collection.insertOne(doc as any)
		if (span) span.end()
		return res.insertedId
	}

	// async insertMany(docs: Array<TDoc>): Promise<Array<TDoc['_id']>> {
	// 	const span = startSpanManual('WrappedCollection.insertMany')
	// 	if (span) {
	// 		span.addLabels({
	// 			collection: this.name,
	// 			ids: unprotectStringArray(docs.map((d) => d._id)).join(','),
	// 		})
	// 	}

	// 	const res = await this.#collection.insertMany(docs as any)
	// 	if (span) span.end()
	// 	return res.insertedIds
	// }

	async replace(doc: TDoc): Promise<boolean> {
		const span = startSpanManual('WrappedCollection.replace')
		if (span) {
			span.addLabels({
				collection: this.name,
				id: unprotectString(doc._id),
			})
		}

		const res = await this.#collection.replaceOne({ _id: doc._id }, doc, {
			upsert: true,
		})
		if (span) span.end()
		return res.matchedCount > 0
	}

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
