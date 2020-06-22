import * as _ from 'underscore'
import {
	mongoWhere,
	literal,
	Omit,
	ProtectedString,
	unprotectString,
	protectString,
	mongoModify,
	mongoFindOptions,
} from '../lib/lib'
import { RandomMock } from './random'
import { UpsertOptions, UpdateOptions, FindOptions, ObserveChangesCallbacks } from '../lib/typings/meteor'
import { MeteorMock } from './meteor'
import { Random } from 'meteor/random'
import { Meteor } from 'meteor/meteor'
const clone = require('fast-clone')

export namespace MongoMock {
	interface ObserverEntry<T extends CollectionObject> {
		id: string
		query: any
		callbacks: ObserveChangesCallbacks<T>
	}

	export interface MockCollections<T extends CollectionObject> {
		[collectionName: string]: MockCollection<T>
	}
	export interface MockCollection<T extends CollectionObject> {
		[id: string]: T
	}
	interface CollectionObject {
		_id: ProtectedString<any>
	}

	const mockCollections: MockCollections<any> = {}
	export interface MongoCollection<T extends CollectionObject> {}
	export class Collection<T extends CollectionObject> implements MongoCollection<T> {
		public _name: string
		private _options: any = {}
		private _isMock: true = true // used in test to check that it's a mock
		private observers: ObserverEntry<T>[] = []

		private _transform?: (o: T) => T

		constructor(name: string, options: any) {
			this._options = options || {}
			this._name = name
			this._transform = this._options.transform
		}
		find(query: any, options?: FindOptions<T>) {
			if (_.isString(query)) query = { _id: query }
			query = query || {}

			const unimplementedUsedOptions = _.without(_.keys(options), 'sort', 'limit', 'fields')
			if (unimplementedUsedOptions.length > 0) {
				throw new Error(`find being performed using unimplemented options: ${unimplementedUsedOptions}`)
			}

			const docsArray = _.values(this.documents)
			let docs = _.compact(
				query._id && _.isString(query._id)
					? [this.documents[query._id]]
					: _.filter(docsArray, (doc) => mongoWhere(doc, query))
			)

			docs = mongoFindOptions(docs, options)

			const observers = this.observers

			return {
				_fetchRaw: () => {
					return docs
				},
				fetch: () => {
					const transform = this._transform ? this._transform : (doc) => doc
					return _.map(docs, (doc) => {
						return transform(clone(doc))
					})
				},
				count: () => {
					return docs.length
				},
				observe(clbs) {
					return {
						stop() {
							// stub
						},
					}
				},
				observeChanges(clbs: ObserveChangesCallbacks<T>) {
					// todo - finish implementing uses of callbacks
					const id = Random.id(5)
					observers.push(
						literal<ObserverEntry<T>>({
							id: id,
							callbacks: clbs,
							query: query,
						})
					)
					return {
						stop() {
							const index = observers.findIndex((o) => o.id === id)
							if (index === -1) throw new Meteor.Error(500, 'Cannot stop observer that is not registered')
							observers.splice(index, 1)
						},
					}
				},
				forEach(f) {
					docs.forEach(f)
				},
				map(f) {
					return docs.map(f)
				},
			}
		}
		findOne(query, options?: Omit<FindOptions<T>, 'limit'>) {
			return this.find(query, options).fetch()[0]
		}
		update(query: any, modifier, options?: UpdateOptions, cb?: Function) {
			try {
				const unimplementedUsedOptions = _.without(_.keys(options), 'multi')
				if (unimplementedUsedOptions.length > 0) {
					throw new Error(`update being performed using unimplemented options: ${unimplementedUsedOptions}`)
				}

				// todo
				let docs = this.find(query)._fetchRaw()

				// By default mongo only updates one doc, unless told multi
				if (!options || !options.multi) {
					docs = _.take(docs, 1)
				}

				// console.log(query, docs)
				_.each(docs, (doc) => {
					const modifiedDoc = mongoModify(query, doc, modifier)
					this.documents[unprotectString(doc._id)] = modifiedDoc

					_.each(_.clone(this.observers), (obs) => {
						if (mongoWhere(doc, obs.query)) {
							if (obs.callbacks.changed) {
								obs.callbacks.changed(doc._id, {}) // TODO - figure out what changed
							}
						}
					})
				})

				if (cb) cb(undefined, docs.length)
				else return docs.length
			} catch (error) {
				if (cb) cb(error, undefined)
				else throw error
			}
		}
		insert(doc: T, cb?: Function) {
			try {
				const d = _.clone(doc)
				if (!d._id) d._id = protectString(RandomMock.id())

				if (this.documents[unprotectString(d._id)]) {
					throw new MeteorMock.Error(500, `Duplicate key '${d._id}'`)
				}

				this.documents[unprotectString(d._id)] = d

				_.each(_.clone(this.observers), (obs) => {
					if (mongoWhere(d, obs.query)) {
						const fields = _.keys(_.omit(d, '_id'))
						if (obs.callbacks.addedBefore) {
							obs.callbacks.addedBefore(d._id, fields, null as any)
						}
						if (obs.callbacks.added) {
							obs.callbacks.added(d._id, fields)
						}
					}
				})

				if (cb) cb(undefined, d._id)
				else return d._id
			} catch (error) {
				if (cb) cb(error, undefined)
				else throw error
			}
		}
		upsert(query: any, modifier, options?: UpsertOptions, cb?: Function) {
			let id = _.isString(query) ? query : query._id

			const docs = this.find(id)._fetchRaw()

			if (docs.length === 1) {
				// console.log(docs)
				this.update(docs[0]._id, modifier, options, cb)
			} else {
				this.insert({
					_id: id,
				} as any)
				this.update(id, modifier, options, cb)
			}
		}
		remove(query: any, cb?: Function) {
			try {
				const docs = this.find(query)._fetchRaw()

				_.each(docs, (doc) => {
					delete this.documents[unprotectString(doc._id)]
				})
				if (cb) cb(undefined, docs.length)
				else return docs.length
			} catch (error) {
				if (cb) cb(error, undefined)
				else throw error
			}
		}

		_ensureIndex(obj: any) {
			// todo
		}
		allow() {
			// todo
		}
		// observe () {
		// 	// todo
		// }
		private get documents(): MockCollection<T> {
			if (!mockCollections[this._name]) mockCollections[this._name] = {}
			return mockCollections[this._name]
		}
	}
	// Mock functions:
	export function mockSetData<T extends CollectionObject>(
		collection: string | MongoCollection<T>,
		data: MockCollection<T> | Array<T> | null
	) {
		const collectionName: string = _.isString(collection)
			? collection
			: (collection as MongoMock.Collection<any>)._name
		data = data || {}
		if (_.isArray(data)) {
			const collectionData = {}
			_.each(data, (doc) => {
				if (!doc._id) throw Error(`mockSetData: "${collectionName}": doc._id missing`)
				collectionData[unprotectString(doc._id)] = doc
			})
			mockCollections[collectionName] = collectionData
		} else {
			mockCollections[collectionName] = data
		}
	}

	export function deleteAllData() {
		Object.keys(mockCollections).forEach((id) => {
			mockCollections[id] = {}
		})
	}
}
export function setup() {
	return {
		Mongo: MongoMock,
	}
}
