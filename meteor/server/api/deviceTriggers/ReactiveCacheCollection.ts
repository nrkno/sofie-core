import { omit } from '@sofie-automation/corelib/dist/lib'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { Mongo } from 'meteor/mongo'
import { ObserveChangesCallbacks } from '../../../lib/collections/lib'

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

	remove(selector: string | Mongo.ObjectID | Mongo.Selector<Document>, callback?: Function): number {
		const num = super.remove(selector, callback)
		if (num > 0) {
			this.runReaction()
		}
		return num
	}

	update(
		selector: string | Mongo.ObjectID | Mongo.Selector<Document>,
		modifier: Mongo.Modifier<Document>,
		options?: {
			multi?: boolean | undefined
			upsert?: boolean | undefined
			arrayFilters?: { [identifier: string]: any }[] | undefined
		},
		callback?: Function
	): number {
		const num = super.update(selector, modifier, options, callback)
		if (num > 0) {
			this.runReaction()
		}
		return num
	}

	upsert(
		selector: string | Mongo.ObjectID | Mongo.Selector<Document>,
		modifier: Mongo.Modifier<Document>,
		options?: { multi?: boolean | undefined },
		callback?: Function
	): { numberAffected?: number | undefined; insertedId?: string | undefined } {
		const res = super.upsert(selector, modifier, options, callback)
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
		selector: string | Mongo.ObjectID | Mongo.Selector<Document>,
		callback?: Function
	): Promise<number> {
		const result = await super.removeAsync(selector, callback)
		if (result > 0) {
			this.runReaction()
		}
		return result
	}

	async updateAsync(
		selector: string | Mongo.ObjectID | Mongo.Selector<Document>,
		modifier: Mongo.Modifier<Document>,
		options?: {
			multi?: boolean | undefined
			upsert?: boolean | undefined
			arrayFilters?: { [identifier: string]: any }[] | undefined
		},
		callback?: Function
	): Promise<number> {
		const result = await super.updateAsync(selector, modifier, options, callback)
		if (result > 0) {
			this.runReaction()
		}
		return result
	}

	async upsertAsync(
		selector: string | Mongo.ObjectID | Mongo.Selector<Document>,
		modifier: Mongo.Modifier<Document>,
		options?: { multi?: boolean | undefined },
		callback?: Function
	): Promise<{ numberAffected?: number | undefined; insertedId?: string | undefined }> {
		const result = await super.upsertAsync(selector, modifier, options, callback)
		if (result.numberAffected || result.insertedId) {
			this.runReaction()
		}
		return result
	}

	link(): ObserveChangesCallbacks<Document> {
		return {
			added: (id: Document['_id'], fields: Partial<Document>) => {
				this.upsert(id, { $set: omit(fields, '_id') as Partial<Document> })
			},
			changed: (id: Document['_id'], fields: Partial<Document>) => {
				const unset: Partial<Record<keyof Document, 1>> = {}
				for (const [key, value] of Object.entries<unknown>(fields)) {
					if (value !== undefined) continue
					unset[key] = 1
				}
				this.upsert(id, { $set: omit(fields, '_id') as Partial<Document>, $unset: unset })
			},
			removed: (id: Document['_id']) => {
				this.remove(id)
			},
		}
	}

	private runReaction() {
		this.reaction?.()
	}
}
