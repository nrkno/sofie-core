import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { PubSub } from '../../lib/api/pubsub'

/**
 * Wrapper around Meteor.publish with stricter typings
 * @param name
 * @param callback
 */
export function meteorPublish<T> (name: PubSub, callback: (...args: any[]) => Mongo.Cursor<T> | null) {
	Meteor.publish(name, function (...args: any[]) {
		return callback(...args) || this.ready
	})
}
