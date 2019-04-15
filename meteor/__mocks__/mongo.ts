import * as _ from 'underscore'
import { pushOntoPath, setOntoPath } from '../lib/lib'
import { RandomMock } from './random'

namespace MongoMock {
	export class Collection {
		localName: string
		documents: {[id: string]: any} = {}
		constructor (localName: string) {
			this.localName = localName
		}
		find (query: any) {
			if (_.isString(query)) query = { _id: query }
			const docs: any[] = _.compact(
				query._id ?
				[this.documents[query._id]] :
				_.findWhere(_.values(this.documents), query)
			)
			return {
				fetch () {
					return docs
				},
				observeChanges () {
					// todo
				}
			}
		}
		findOne (query) {
			return this.find(query).fetch()[0]
		}
		update (query: string, modifier) {
			// todo
			let docs = this.find(query).fetch()
			_.each(docs, (doc) => {
				_.each(modifier, (value: any, key: string) => {

					if (key === '$set') {
						_.each(value, (value: any, key: string) => {
							setOntoPath(doc, key, value )
						})
					} else if (key === '$push') {
						_.each(value, (value: any, key: string) => {
							pushOntoPath(doc, key, value )
						})
					} else {
						// setOntoPath(doc, key, value )
					}

				})
			})
			return docs.length
		}
		insert (doc) {
			let d = _.extend({}, doc)
			if (!d._id) d._id = RandomMock.id()
			this.documents[d._id] = d
		}
		upsert (query: any, modifier) {
			let id = _.isString(query) ? query : query._id

			const docs = this.find(id).fetch()

			if (docs.length === 1) {
				this.update(docs[0]._id, modifier)
			} else {
				this.insert({
					_id: id
				})
				this.update(id, modifier)
			}
		}
		remove (query: any) {
			const docs = this.find(query).fetch()

			_.each(docs, (doc) => {
				delete this.documents[doc._id]
			})
		}

		allow () {
			// todo
		}
		observe () {
			// todo
		}
	}
}
export function setup () {
	return {
		Mongo: MongoMock
	}
}
