import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { FilterQuery, UpdateQuery, Collection } from 'mongodb'
import { ReadonlyDeep } from 'type-fest'
import { FindOptions, ICollection } from '../collection'

export class MongoCollection<TDoc extends { _id: ProtectedString<any> }> implements ICollection<TDoc> {
	constructor(private readonly collection: Collection<TDoc>) {}

	get name(): string {
		return this.collection.collectionName
	}

	findFetch(_selector?: FilterQuery<TDoc> | TDoc['_id'], _options?: FindOptions<TDoc>): Promise<TDoc[]> {
		throw new Error('Method not implemented.')
	}
	findOne(_selector?: FilterQuery<TDoc> | TDoc['_id'], _options?: FindOptions<TDoc>): Promise<TDoc | undefined> {
		throw new Error('Method not implemented.')
	}
	async insert(_doc: TDoc | ReadonlyDeep<TDoc>): Promise<TDoc['_id']> {
		// this.collection.insertOne(doc)
		throw new Error('Method not implemented.')
	}
	remove(_selector: FilterQuery<TDoc> | TDoc['_id']): Promise<Array<TDoc['_id']>> {
		throw new Error('Method not implemented.')
	}
	update(_selector: FilterQuery<TDoc> | TDoc['_id'], _modifier: UpdateQuery<TDoc>): Promise<number> {
		throw new Error('Method not implemented.')
	}
	replace(_doc: TDoc | ReadonlyDeep<TDoc>): Promise<boolean> {
		throw new Error('Method not implemented.')
	}
}
