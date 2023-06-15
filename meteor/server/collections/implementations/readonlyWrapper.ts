import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { Meteor } from 'meteor/meteor'
import { MongoCursor } from '../../../lib/collections/lib'
import type { Collection } from 'mongodb'
import { AsyncOnlyMongoCollection, AsyncOnlyReadOnlyMongoCollection } from '../collection'

export class WrappedReadOnlyMongoCollection<DBInterface extends { _id: ProtectedString<any> }>
	implements AsyncOnlyReadOnlyMongoCollection<DBInterface>
{
	#mutableCollection: AsyncOnlyMongoCollection<DBInterface>

	constructor(collection: AsyncOnlyMongoCollection<DBInterface>) {
		this.#mutableCollection = collection
	}

	protected get _isMock(): boolean {
		// @ts-expect-error re-export private property
		return this.#mutableCollection._isMock
	}

	public get mockCollection(): any {
		// @ts-expect-error re-export private property
		return this.#mutableCollection.mockCollection
	}

	get mutableCollection(): AsyncOnlyMongoCollection<DBInterface> {
		return this.#mutableCollection
	}

	get name(): string | null {
		return this.#mutableCollection.name
	}

	rawCollection(): Collection<DBInterface> {
		return this.#mutableCollection.rawCollection()
	}

	async findFetchAsync(
		...args: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['findFetchAsync']>
	): Promise<DBInterface[]> {
		return this.#mutableCollection.findFetchAsync(...args)
	}

	async findOneAsync(
		...args: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['findOneAsync']>
	): Promise<DBInterface | undefined> {
		return this.#mutableCollection.findOneAsync(...args)
	}

	async findWithCursor(
		...args: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['findWithCursor']>
	): Promise<MongoCursor<DBInterface>> {
		return this.#mutableCollection.findWithCursor(...args)
	}

	observeChanges(
		...args: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['observeChanges']>
	): Meteor.LiveQueryHandle {
		return this.#mutableCollection.observeChanges(...args)
	}

	observe(...args: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['observe']>): Meteor.LiveQueryHandle {
		return this.#mutableCollection.observe(...args)
	}

	async countDocuments(
		...args: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['countDocuments']>
	): Promise<number> {
		return this.#mutableCollection.countDocuments(...args)
	}

	_ensureIndex(...args: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['_ensureIndex']>): void {
		return this.#mutableCollection._ensureIndex(...args)
	}
}
