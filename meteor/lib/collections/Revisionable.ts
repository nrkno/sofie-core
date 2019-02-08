import { Mongo } from 'meteor/mongo'

export interface Revisionable {
	revision: number
}

export class RevisionCollection<T extends Revisionable> extends Mongo.Collection<T> {
	insert (doc: T, callback?: Function) {
		doc.revision = 0

		return super.insert(doc, callback)
	}

	update (selector: Mongo.Selector<T> | Mongo.ObjectID | string, modifier: Mongo.Modifier<T>, options?: {
		multi?: boolean;
		upsert?: boolean;
	}, callback?: Function) {
		if (this.isT(modifier)) {
			if (callback) {
				return super.update(selector, modifier, options, (e, v: number) => {
					if (e || v === 0) {
						callback(e, v)
						return
					}

					let m: Mongo.Modifier<T> = { $inc: { /* revision: 1 */ } }
					if (!this.isT(m) && m.$inc) {
						m.$inc.revision = 1
					}
					// TODO - is the callback usage here correct?
					super.update(selector, m, { multi: options ? options.multi : false}, callback)
				})
			}
			const res = super.update(selector, modifier, options)

			if (res > 0) {
				let m: Mongo.Modifier<T> = { $inc: { /* revision: 1 */ } }
				if (!this.isT(m) && m.$inc) {
					m.$inc.revision = 1
				}
				super.update(selector, m, { multi: options ? options.multi : false})
			}

			return res
		} else {
			if (!modifier.$inc) modifier.$inc = {}
			modifier.$inc.revision = 1
			return super.update(selector, modifier, options, callback)
		}
	}

	upsert (selector: Mongo.Selector<T> | Mongo.ObjectID | string, modifier: Mongo.Modifier<T>, options?: {
		multi?: boolean;
	}, callback?: Function) {
		if (this.isT(modifier)) {
			if (callback) {
				return super.upsert(selector, modifier, options, (e, v) => {
					if (e) { // TODO - skip the update below if v says none updated
						callback(e, v)
						return
					}
					let m: Mongo.Modifier<T> = { $inc: { /* revision: 1 */ } }
					if (!this.isT(m) && m.$inc) {
						m.$inc.revision = 1
					}
					// TODO - is the callback usage here correct?
					super.update(selector, m, { multi: options ? options.multi : false}, callback)
				})
			}
			const res = super.upsert(selector, modifier, options)

			if (res.numberAffected || 0 > 0) {
				let m: Mongo.Modifier<T> = { $inc: { /* revision: 1 */ } }
				if (!this.isT(m) && m.$inc) {
					m.$inc.revision = 1
				}
				super.upsert(selector, m, { multi: options ? options.multi : false})
			}

			return res
		} else {
			if (!modifier.$inc) modifier.$inc = {}
			modifier.$inc.revision = 1
			return super.upsert(selector, modifier, options, callback)
		}
	}

	private isT (modifier: Mongo.Modifier<T>): modifier is T {
		return !(modifier['$set'] || modifier['unset'] || modifier['push']) // TODO - fill out
	}
}
