import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { FilterQuery, UpdateQuery } from 'mongodb'
import { ReadonlyDeep } from 'type-fest'
import { FindOptions, ICollection } from '../collection'
import { Collection } from 'mongodb'

export class MongoCollection<TDoc extends { _id: ProtectedString<any> }> implements ICollection<TDoc> {
	constructor(private readonly collection: Collection<TDoc>) {}

	get name(): string {
		return this.collection.collectionName
	}

	findFetch(selector?: FilterQuery<TDoc> | TDoc['_id'], options?: FindOptions<TDoc>): Promise<TDoc[]> {
		throw new Error('Method not implemented.')
	}
	findOne(selector?: FilterQuery<TDoc> | TDoc['_id'], options?: FindOptions<TDoc>): Promise<TDoc | undefined> {
		throw new Error('Method not implemented.')
	}
	async insert(doc: TDoc | ReadonlyDeep<TDoc>): Promise<TDoc['_id']> {
		this.collection.insertOne(doc)
		throw new Error('Method not implemented.')
	}
	remove(selector: FilterQuery<TDoc> | TDoc['_id']): Promise<Array<TDoc['_id']>> {
		throw new Error('Method not implemented.')
	}
	update(selector: FilterQuery<TDoc> | TDoc['_id'], modifier: UpdateQuery<TDoc>): Promise<number> {
		throw new Error('Method not implemented.')
	}
	replace(doc: TDoc | ReadonlyDeep<TDoc>): Promise<boolean> {
		throw new Error('Method not implemented.')
	}
}
