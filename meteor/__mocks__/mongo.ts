import * as _ from 'underscore'
import { pushOntoPath, setOntoPath, mongoWhere, literal, unsetPath, pullFromPath, Omit } from '../lib/lib'
import { RandomMock } from './random'
import { UpsertOptions, UpdateOptions, MongoSelector, FindOptions } from '../lib/typings/meteor'
import { MeteorMock } from './meteor'
import { Mongo } from 'meteor/mongo'
import { Random } from 'meteor/random'
import { Meteor } from 'meteor/meteor'
const clone = require('fast-clone')

interface ObserverEntry {
	id: string
	callbacks: Mongo.ObserveChangesCallbacks
	query: any
}

export namespace MongoMock {
	export interface MockCollections<T extends CollectionObject> {
		[collectionName: string]: MockCollection<T>
	}
	export interface MockCollection<T extends CollectionObject> {
		[id: string]: T
	}
	interface CollectionObject {
		_id: string
	}

	const mockCollections: MockCollections<any> = {}
	export interface MongoCollection<T extends CollectionObject> {
	}
	export class Collection<T extends CollectionObject> implements MongoCollection<T> {
		private localName: string
		private _options: any = {}
		private _isMock: true = true // used in test to check that it's a mock
		private observers: ObserverEntry[] = []

		constructor (localName: string, options: any) {
			this.localName = localName
			this._options = options || {}
		}
		find (query: any, options?: FindOptions) {
			if (_.isString(query)) query = { _id: query }
			query = query || {}

			const unimplementedUsedOptions = _.without(_.keys(options), 'sort', 'limit')
			if (unimplementedUsedOptions.length > 0) {
				throw new Error(`find being performed using unimplemented options: ${unimplementedUsedOptions}`)
			}

			const docsArray = _.values(this.documents)
			let docs = _.compact((
				query._id && _.isString(query._id) ?
				[this.documents[query._id]] :
				_.filter(docsArray, (doc) => mongoWhere(doc, query))
			))

			if (options && options.sort) {
				let tmpDocs = _.chain(docs)
				for (const key of _.keys(options.sort)) {
					const dir = options.sort[key]
					// TODO - direction
					tmpDocs = tmpDocs.sortBy(doc => doc[key])
				}
				docs = tmpDocs.value()
			}

			if (options && options.limit !== undefined) {
				docs = _.take(docs, options.limit)
			}

			const observers = this.observers

			return {
				_fetchRaw: () => {
					return docs
				},
				fetch: () => {
					const transform = (
						this._options.transform ?
						this._options.transform :
						(doc) => doc
					)
					return _.map(docs, (doc) => {
						return transform(clone(doc))
					})
				},
				count: () => {
					return docs.length
				},
				observe (clbs) {
					return {
						stop () {
							// stub
						}
					}
				},
				observeChanges (clbs: Mongo.ObserveChangesCallbacks) { // todo - finish implementing uses of callbacks
					const id = Random.id(5)
					observers.push(literal<ObserverEntry>({
						id: id,
						callbacks: clbs,
						query: query
					}))
					return {
						stop () {
							const index = observers.findIndex(o => o.id === id)
							if (index === -1) throw new Meteor.Error(500, 'Cannot stop observer that is not registered')
							observers.splice(index, 1)
						}
					}
				},
				forEach (f) {
					docs.forEach(f)
				}
			}
		}
		findOne (query, options?: Omit<FindOptions, 'limit'>) {
			return this.find(query, options).fetch()[0]
		}
		update (query: any, modifier, options?: UpdateOptions, cb?: Function) {
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
					let replace = false

					_.each(modifier, (value: any, key: string) => {
						if (key === '$set') {
							_.each(value, (value: any, key: string) => {
								setOntoPath(doc, key, query, value)
							})
						} else if (key === '$unset') {
							_.each(value, (value: any, key: string) => {
								unsetPath(doc, key, query)
							})
						} else if (key === '$push') {
							_.each(value, (value: any, key: string) => {
								pushOntoPath(doc, key, value)
							})
						} else if (key === '$pull') {
							_.each(value, (value: any, key: string) => {
								pullFromPath(doc, key, value)
							})
						} else {
							if (key[0] === '$') {
								throw Error(`Update method "${key}" not implemented yet`)
							} else {
								replace = true
							}
							// setOntoPath(doc, key, value )
						}

					})
					if (replace) {
						this.remove(doc._id)
						if (!modifier._id) modifier._id = doc._id
						this.insert(modifier)
					}

					_.each(_.clone(this.observers), obs => {
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
		insert (doc: T, cb?: Function) {
			try {
				const d = _.clone(doc)
				if (!d._id) d._id = RandomMock.id()

				if (this.documents[d._id]) {
					throw new MeteorMock.Error(500, `Duplicate key '${d._id}'`)
				}

				this.documents[d._id] = d

				_.each(_.clone(this.observers), obs => {
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
		upsert (query: any, modifier, options?: UpsertOptions, cb?: Function) {
			let id = _.isString(query) ? query : query._id

			const docs = this.find(id)._fetchRaw()

			if (docs.length === 1) {
				// console.log(docs)
				this.update(docs[0]._id, modifier, options, cb)
			} else {
				this.insert({
					_id: id
				} as any)
				this.update(id, modifier, options, cb)
			}
		}
		remove (query: any, cb?: Function) {
			try {
				const docs = this.find(query)._fetchRaw()

				_.each(docs, (doc) => {
					delete this.documents[doc._id]
				})
				if (cb) cb(undefined, docs.length)
				else return docs.length
			} catch (error) {
				if (cb) cb(error, undefined)
				else throw error
			}
		}

		_ensureIndex (obj: any) {
			// todo
		}
		allow () {
			// todo
		}
		// observe () {
		// 	// todo
		// }
		private get documents (): MockCollection<T> {
			if (!mockCollections[this.localName]) mockCollections[this.localName] = {}
			return mockCollections[this.localName]
		}
	}
	// Mock functions:
	export function mockSetData<T extends CollectionObject> (collection: string | MongoCollection<T>, data: MockCollection<T> | Array<T> | null) {
		const collectionName: string = (
			_.isString(collection) ?
			collection :
			// @ts-ignore
			collection.localName
		)
		data = data || {}
		if (_.isArray(data)) {
			const collectionData = {}
			_.each(data, (doc) => {
				if (!doc._id) throw Error(`mockSetData: "${collectionName}": doc._id missing`)
				collectionData[doc._id] = doc
			})
			mockCollections[collectionName] = collectionData
		} else {
			mockCollections[collectionName] = data
		}
	}
}
export function setup () {
	return {
		Mongo: MongoMock
	}
}
