import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { PubSub } from '../../lib/api/pubsub'
import { extractFunctionSignature } from '../../lib/lib'

export const MeteorPublicationSignatures: {[key: string]: string[]} = {}
export const MeteorPublications: {[key: string]: Function} = {}

/**
 * Wrapper around Meteor.publish with stricter typings
 * @param name
 * @param callback
 */
export function meteorPublish<T> (name: PubSub, callback: (...args: any[]) => Mongo.Cursor<T> | null) {

	const signature = extractFunctionSignature(callback)
	if (signature) MeteorPublicationSignatures[name] = signature

	MeteorPublications[name] = callback

	Meteor.publish(name, function (...args: any[]) {
		return callback(...args) || this.ready
	})
}
