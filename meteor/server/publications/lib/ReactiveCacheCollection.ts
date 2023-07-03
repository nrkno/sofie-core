import { omit } from '@sofie-automation/corelib/dist/lib'
import { ProtectedString, isProtectedString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { Mongo } from 'meteor/mongo'
import { ObserveCallbacks } from '../../../lib/collections/lib'

type Reaction = () => void

export class ReactiveCacheCollection<Document extends { _id: ProtectedString<any> }> {
	readonly #collection: Mongo.Collection<Document>

	constructor(public collectionName: string, private reaction?: Reaction) {
		this.#collection = new Mongo.Collection<Document>(null)
	}

	find(
		selector: Document['_id'] | Mongo.Selector<Document>,
		options?: Mongo.Options<Document>
	): Mongo.Cursor<Document, Document> {
		return this.#collection.find(isProtectedString(selector) ? unprotectString(selector) : selector, options)
	}

	findOne(
		selector: Document['_id'] | Mongo.Selector<Document>,
		options?: Omit<Mongo.Options<Document>, 'limit'>
	): Document | undefined {
		return this.#collection.findOne(isProtectedString(selector) ? unprotectString(selector) : selector, options)
	}

	insert(doc: Mongo.OptionalId<Document>): string {
		const id = this.#collection.insert(doc)
		this.runReaction()
		return id
	}

	remove(selector: Document['_id'] | Mongo.Selector<Document>): number {
		const num = this.#collection.remove(isProtectedString(selector) ? unprotectString(selector) : selector)
		if (num > 0) {
			this.runReaction()
		}
		return num
	}

	update(
		selector: Document['_id'] | Mongo.Selector<Document>,
		modifier: Mongo.Modifier<Document>,
		options?: {
			multi?: boolean
			upsert?: boolean
			arrayFilters?: { [identifier: string]: any }[]
		}
	): number {
		const num = this.#collection.update(
			isProtectedString(selector) ? unprotectString(selector) : selector,
			modifier,
			options
		)
		if (num > 0) {
			this.runReaction()
		}
		return num
	}

	upsert(
		selector: Document['_id'] | Mongo.Selector<Document>,
		modifier: Mongo.Modifier<Document>,
		options?: { multi?: boolean }
	): { numberAffected?: number; insertedId?: string } {
		const res = this.#collection.upsert(
			isProtectedString(selector) ? unprotectString(selector) : selector,
			modifier,
			options
		)
		if (res.numberAffected || res.insertedId) {
			this.runReaction()
		}
		return res
	}

	async insertAsync(doc: Mongo.OptionalId<Document>): Promise<string> {
		const result = await this.#collection.insertAsync(doc)
		this.runReaction()
		return result
	}

	async removeAsync(selector: Document['_id'] | Mongo.Selector<Document>): Promise<number> {
		const result = await this.#collection.removeAsync(
			isProtectedString(selector) ? unprotectString(selector) : selector
		)
		if (result > 0) {
			this.runReaction()
		}
		return result
	}

	async updateAsync(
		selector: Document['_id'] | Mongo.Selector<Document>,
		modifier: Mongo.Modifier<Document>,
		options?: {
			multi?: boolean
			upsert?: boolean
			arrayFilters?: { [identifier: string]: any }[]
		}
	): Promise<number> {
		const result = await this.#collection.updateAsync(
			isProtectedString(selector) ? unprotectString(selector) : selector,
			modifier,
			options
		)
		if (result > 0) {
			this.runReaction()
		}
		return result
	}

	async upsertAsync(
		selector: Document['_id'] | Mongo.Selector<Document>,
		modifier: Mongo.Modifier<Document>,
		options?: { multi?: boolean }
	): Promise<{ numberAffected?: number; insertedId?: string }> {
		const result = await this.#collection.upsertAsync(
			isProtectedString(selector) ? unprotectString(selector) : selector,
			modifier,
			options
		)
		if (result.numberAffected || result.insertedId) {
			this.runReaction()
		}
		return result
	}

	link(cb?: () => void): ObserveCallbacks<Document> {
		return {
			added: (doc: Document) => {
				this.upsert(doc._id, { $set: omit(doc, '_id') as Partial<Document> })
				cb?.()
			},
			changed: (doc: Document) => {
				this.upsert(doc._id, { $set: omit(doc, '_id') as Partial<Document> })
				cb?.()
			},
			removed: (doc: Document) => {
				this.remove(doc._id)
				cb?.()
			},
		}
	}

	private runReaction() {
		this.reaction?.()
	}
}
