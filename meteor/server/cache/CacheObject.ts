import {
	ProtectedString,
	asyncCollectionFindOne,
	mongoModify,
	unprotectString,
	Changes,
	asyncCollectionUpdate,
	getRandomId,
	asyncCollectionUpsert,
	clone,
} from '../../lib/lib'
import { TransformedCollection, MongoModifier } from '../../lib/typings/meteor'
import { Meteor } from 'meteor/meteor'
import { DeepReadonly } from 'utility-types'
import _ from 'underscore'
import { profiler } from '../api/profiler'

export class DbCacheReadObject<
	Class extends DBInterface,
	DBInterface extends { _id: ProtectedString<any> },
	DocOptional extends boolean = false
> {
	protected _document: Class
	private _initialized = false

	constructor(protected _collection: TransformedCollection<Class, DBInterface>) {
		//
	}
	get name(): string | undefined {
		return this._collection['name']
	}

	async _initialize(id: DBInterface['_id']): Promise<void> {
		if (!this._initialized) {
			const doc = await asyncCollectionFindOne<Class, DBInterface>(this._collection, id)
			if (!doc) {
				throw new Meteor.Error(
					404,
					`DbCacheReadObject population for "${this.name}" failed. Document "${id}" was not found`
				)
			}
			this._document = doc
			this._initialized = true
		}
	}

	_fromDoc(doc: Class) {
		if (this._initialized) {
			throw new Meteor.Error(500, `DbCacheReadObject population for "${this.name}" failed. Already initialized`)
		}

		this._document = doc
		this._initialized = true
	}

	get doc(): DocOptional extends true ? DeepReadonly<Class> | undefined : DeepReadonly<Class> {
		return this._document as any
	}
}

export class DbCacheWriteObject<
	Class extends DBInterface,
	DBInterface extends { _id: ProtectedString<any> },
	DocOptional extends boolean = false
> extends DbCacheReadObject<Class, DBInterface, DocOptional> {
	private _updated = false

	constructor(collection: TransformedCollection<Class, DBInterface>) {
		super(collection)
	}

	update(modifier: ((doc: DBInterface) => DBInterface) | MongoModifier<DBInterface>): boolean {
		const localDoc: DeepReadonly<Class> | undefined = this.doc
		if (!localDoc) throw new Meteor.Error(404, `Error: The document does not yet exist`)

		let newDoc: DBInterface = _.isFunction(modifier)
			? modifier(clone(localDoc))
			: mongoModify({}, clone(localDoc), modifier)

		if (unprotectString(newDoc._id) !== unprotectString(localDoc._id)) {
			throw new Meteor.Error(
				500,
				`Error: The (immutable) field '_id' was found to have been altered to _id: "${newDoc._id}"`
			)
		}

		if (!_.isEqual(this.doc, newDoc)) {
			newDoc = this._transform(newDoc)

			_.each(_.uniq([..._.keys(newDoc), ..._.keys(this.doc)]), (key) => {
				localDoc[key] = newDoc[key]
			})

			this._updated = true
			return true
		}

		return false
	}

	async updateDatabaseWithData(): Promise<Changes> {
		if (this._updated) {
			const span = profiler.startSpan(`DbCacheWriteObject.updateDatabaseWithData.${this.name}`)

			const pUpdate = await asyncCollectionUpdate(this._collection, this._document._id, this._document)
			if (pUpdate < 1) {
				throw new Meteor.Error(500, `Failed to update`)
			}

			if (span) span.end()

			return {
				added: 0,
				updated: 1,
				removed: 0,
			}
		} else {
			return {
				added: 0,
				updated: 0,
				removed: 0,
			}
		}
	}

	protected _transform(doc: DBInterface): Class {
		// @ts-ignore hack: using internal function in collection
		const transform = this._collection._transform
		if (transform) {
			return transform(doc)
		} else return doc as Class
	}
}

export class DbCacheWriteOptionalObject<
	Class extends DBInterface,
	DBInterface extends { _id: ProtectedString<any> }
> extends DbCacheWriteObject<Class, DBInterface, true> {
	private _inserted = false

	constructor(collection: TransformedCollection<Class, DBInterface>) {
		super(collection)
	}

	replace(doc: DBInterface): DeepReadonly<Class> {
		this._inserted = true

		if (!doc._id) doc._id = getRandomId()

		this._document = this._transform(clone(doc))

		return this._document as any
	}

	async updateDatabaseWithData(): Promise<Changes> {
		if (this._inserted) {
			const span = profiler.startSpan(`DbCacheWriteOptionalObject.updateDatabaseWithData.${this.name}`)

			await asyncCollectionUpsert(this._collection, this._document._id, this._document)

			if (span) span.end()

			return {
				added: 1,
				updated: 0,
				removed: 0,
			}
		} else {
			return super.updateDatabaseWithData()
		}
	}
}
