import { omit } from '@sofie-automation/corelib/dist/lib'
import { ProtectedString, isProtectedString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { Mongo } from 'meteor/mongo'
import { ObserveCallbacks } from '../../../lib/collections/lib'

type Reaction = () => void

export class ReactiveCacheCollection<
	Document extends { _id: ProtectedString<any> }
> extends Mongo.Collection<Document> {
	constructor(public collectionName: string, private reaction?: Reaction) {
		super(null)
	}

	insert(doc: Mongo.OptionalId<Document>, callback?: Function): string {
		const id = super.insert(doc, callback)
		this.runReaction()
		return id
	}

	remove(
		selector: Document['_id'] | string | Mongo.ObjectID | Mongo.Selector<Document>,
		callback?: Function
	): number {
		const num = super.remove(isProtectedString(selector) ? unprotectString(selector) : selector, callback)
		if (num > 0) {
			this.runReaction()
		}
		return num
	}

	update(
		selector: Document['_id'] | string | Mongo.ObjectID | Mongo.Selector<Document>,
		modifier: Mongo.Modifier<Document>,
		options?: {
			multi?: boolean | undefined
			upsert?: boolean | undefined
			arrayFilters?: { [identifier: string]: any }[] | undefined
		},
		callback?: Function
	): number {
		const num = super.update(
			isProtectedString(selector) ? unprotectString(selector) : selector,
			modifier,
			options,
			callback
		)
		if (num > 0) {
			this.runReaction()
		}
		return num
	}

	upsert(
		selector: Document['_id'] | string | Mongo.ObjectID | Mongo.Selector<Document>,
		modifier: Mongo.Modifier<Document>,
		options?: { multi?: boolean | undefined },
		callback?: Function
	): { numberAffected?: number | undefined; insertedId?: string | undefined } {
		const res = super.upsert(
			isProtectedString(selector) ? unprotectString(selector) : selector,
			modifier,
			options,
			callback
		)
		if (res.numberAffected || res.insertedId) {
			this.runReaction()
		}
		return res
	}

	async insertAsync(doc: Mongo.OptionalId<Document>, callback?: Function): Promise<string> {
		const result = await super.insertAsync(doc)
		this.runReaction()
		callback?.()
		return result
	}

	async removeAsync(
		selector: Document['_id'] | string | Mongo.ObjectID | Mongo.Selector<Document>,
		callback?: Function
	): Promise<number> {
		const result = await super.removeAsync(
			isProtectedString(selector) ? unprotectString(selector) : selector,
			callback
		)
		if (result > 0) {
			this.runReaction()
		}
		return result
	}

	async updateAsync(
		selector: Document['_id'] | string | Mongo.ObjectID | Mongo.Selector<Document>,
		modifier: Mongo.Modifier<Document>,
		options?: {
			multi?: boolean | undefined
			upsert?: boolean | undefined
			arrayFilters?: { [identifier: string]: any }[] | undefined
		},
		callback?: Function
	): Promise<number> {
		const result = await super.updateAsync(
			isProtectedString(selector) ? unprotectString(selector) : selector,
			modifier,
			options,
			callback
		)
		if (result > 0) {
			this.runReaction()
		}
		return result
	}

	async upsertAsync(
		selector: Document['_id'] | string | Mongo.ObjectID | Mongo.Selector<Document>,
		modifier: Mongo.Modifier<Document>,
		options?: { multi?: boolean | undefined },
		callback?: Function
	): Promise<{ numberAffected?: number | undefined; insertedId?: string | undefined }> {
		const result = await super.upsertAsync(
			isProtectedString(selector) ? unprotectString(selector) : selector,
			modifier,
			options,
			callback
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
