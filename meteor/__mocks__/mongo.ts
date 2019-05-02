import * as _ from 'underscore'
import { pushOntoPath, setOntoPath, mongoWhere } from '../lib/lib'
import { RandomMock } from './random'
import { UpsertOptions, UpdateOptions } from '../lib/typings/meteor'
import { MeteorMock } from './meteor'
const clone = require('fast-clone')

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

		constructor (localName: string, options: any) {
			this.localName = localName
			this._options = options || {}
		}
		find (query: any) {
			if (_.isString(query)) query = { _id: query }
			query = query || {}

			const docsArray = _.values(this.documents)
			const docs: any[] = _.compact((
				query._id && _.isString(query._id) ?
				[this.documents[query._id]] :
				_.filter(docsArray, (doc) => mongoWhere(doc, query))
			))

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
				observeChanges (clbs) {
					return {
						stop () {
							// stub
						}
					}
				}
			}
		}
		findOne (query) {
			return this.find(query).fetch()[0]
		}
		update (query: string, modifier, _options?: UpdateOptions, cb?: Function) {
			try {

				// todo
				let docs = this.find(query)._fetchRaw()
				_.each(docs, (doc) => {
					let replace = false

					_.each(modifier, (value: any, key: string) => {
						if (key === '$set') {
							_.each(value, (value: any, key: string) => {
								setOntoPath(doc, key, value)
							})
						} else if (key === '$push') {
							_.each(value, (value: any, key: string) => {
								pushOntoPath(doc, key, value)
							})
						} else {
							if (key[0] === '$') {
								throw Error('Update method not implemented yet')
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
				})

				if (cb) cb(undefined, docs.length)
				else return docs.length
			} catch (error) {
				if (cb) cb(error, undefined)
				else throw error
			}
		}
		insert (doc, cb?: Function) {
			try {
				let d = _.extend({}, doc)
				if (!d._id) d._id = RandomMock.id()

				if (this.documents[d._id]) {
					throw new MeteorMock.Error(500, `Duplicate key '${d._id}'`)
				}
				this.documents[d._id] = d

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
				console.log(docs)
				this.update(docs[0]._id, modifier, options, cb)
			} else {
				this.insert({
					_id: id
				})
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

		allow () {
			// todo
		}
		// observe () {
		// 	// todo
		// }
		private get documents () {
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
