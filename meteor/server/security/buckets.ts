import { Buckets, BucketId, Bucket } from '../../lib/collections/Buckets'
import { MongoQuery } from '../../lib/typings/meteor'
import { Credentials, ResolvedCredentials } from './lib/credentials'
import { triggerWriteAccess } from './lib/securityVerify'
import { PieceId } from '../../lib/collections/Pieces'
import { Settings } from '../../lib/Settings'
import { check } from '../../lib/check'
import { Meteor } from 'meteor/meteor'
import { StudioReadAccess, StudioContentWriteAccess, StudioContentAccess } from './studio'
import { BucketAdLib, BucketAdLibs } from '../../lib/collections/BucketAdlibs'
import { BucketAdLibAction, BucketAdLibActions } from '../../lib/collections/BucketAdlibActions'
import { AdLibActionId } from '../../lib/collections/AdLibActions'

export namespace BucketSecurity {
	export interface BucketContentAccess extends StudioContentAccess {
		bucket: Bucket
	}
	export interface BucketAdlibPieceContentAccess extends StudioContentAccess {
		adlib: BucketAdLib
	}
	export interface BucketAdlibActionContentAccess extends StudioContentAccess {
		action: BucketAdLibAction
	}

	// Sometimes a studio ID is passed, others the peice / bucket id
	export function allowReadAccess(
		selector: MongoQuery<{ _id: BucketId }>,
		token: string,
		cred: Credentials | ResolvedCredentials
	) {
		check(selector, Object)
		if (!Settings.enableUserAccounts) return true
		if (!selector._id) throw new Meteor.Error(400, 'selector must contain bucket or piece id')
		const bucket = Buckets.findOne(selector)
		if (!bucket) throw new Meteor.Error(404, `Bucket "${selector._id}" not found!`)

		return StudioReadAccess.studioContent(bucket, { ...cred, token })
	}
	export function allowWriteAccess(cred: Credentials, bucketId: BucketId): BucketContentAccess {
		triggerWriteAccess()

		check(bucketId, String)

		const bucket = Buckets.findOne(bucketId)
		if (!bucket) throw new Meteor.Error(404, `Bucket "${bucketId}" not found!`)

		return {
			...StudioContentWriteAccess.bucket(cred, bucket.studioId),
			bucket,
		}
	}
	export function allowWriteAccessPiece(cred: Credentials, pieceId: PieceId): BucketAdlibPieceContentAccess {
		triggerWriteAccess()

		check(pieceId, String)

		const bucketAdLib = BucketAdLibs.findOne(pieceId)
		if (!bucketAdLib) throw new Meteor.Error(404, `Bucket AdLib "${pieceId}" not found!`)

		return {
			...StudioContentWriteAccess.bucket(cred, bucketAdLib.studioId),
			adlib: bucketAdLib,
		}
	}
	export function allowWriteAccessAction(cred: Credentials, actionId: AdLibActionId): BucketAdlibActionContentAccess {
		triggerWriteAccess()

		check(actionId, String)

		const bucketAdLibAction = BucketAdLibActions.findOne(actionId)
		if (!bucketAdLibAction) throw new Meteor.Error(404, `Bucket AdLib Actions "${actionId}" not found!`)

		return {
			...StudioContentWriteAccess.bucket(cred, bucketAdLibAction.studioId),
			action: bucketAdLibAction,
		}
	}
}
