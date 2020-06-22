import { rejectFields, logNotAllowed } from './lib/lib'
import { Buckets, Bucket, BucketId } from '../../lib/collections/Buckets'
import { UserId, MongoQuery } from '../../lib/typings/meteor'
import { Credentials, ResolvedCredentials } from './lib/credentials'
import { triggerWriteAccess } from './lib/securityVerify'
import { PieceId } from '../../lib/collections/Pieces'
import { Settings } from '../../lib/Settings'
import { check } from '../../lib/check'
import { Meteor } from 'meteor/meteor'

export namespace BucketSecurity {
	// Sometimes a studio ID is passed, others the peice / bucket id
	export function allowReadAccess(
		selector: MongoQuery<{ _id: BucketId | PieceId }>,
		token: string,
		cred: Credentials | ResolvedCredentials
	) {
		check(selector, Object)
		if (!Settings.enableUserAccounts) return true
		if (!selector._id) throw new Meteor.Error(400, 'selector must contain bucket or piece id')

		return true
	}
	export function allowWriteAccess(
		selector: MongoQuery<{ _id: BucketId | PieceId }>,
		cred: Credentials | ResolvedCredentials
	) {
		triggerWriteAccess()

		check(selector, Object)
		if (!Settings.enableUserAccounts) return true
		if (!selector.studioId) throw new Meteor.Error(400, 'selector must contain studioId')

		// TODO: implement some security here

		return true
	}
}
// Setup rules:

Buckets.allow({
	insert(userId: UserId, doc: Bucket): boolean {
		return false
	},
	update(userId, doc, fields, modifier) {
		return rejectFields(doc, fields, ['_id'])
	},
	remove(userId, doc) {
		return false
	},
})
