import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { PubSub } from '../../lib/api/pubsub'
import { extractFunctionSignature } from '../lib'
import { Mongocursor } from '../../lib/typings/meteor'
import { ProtectedString } from '../../lib/lib'

export const MeteorPublicationSignatures: {[key: string]: string[]} = {}
export const MeteorPublications: {[key: string]: Function} = {}

/**
 * Wrapper around Meteor.publish with stricter typings
 * @param name
 * @param callback
 */
export function meteorPublish<T extends { _id: ProtectedString<any> }> (name: PubSub, callback: (...args: any[]) => Mongocursor<T> | null) {

	const signature = extractFunctionSignature(callback)
	if (signature) MeteorPublicationSignatures[name] = signature

	MeteorPublications[name] = callback

	Meteor.publish(name, function (...args: any[]) {
		return callback(...args) || this.ready
	})
}
