import { Bucket } from '../../lib/collections/Buckets'
import { Credentials, ResolvedCredentials } from './lib/credentials'
import { triggerWriteAccess } from './lib/securityVerify'
import { check } from '../../lib/check'
import { Meteor } from 'meteor/meteor'
import { StudioReadAccess, StudioContentWriteAccess, StudioContentAccess } from './studio'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { AdLibActionId, BucketId, PieceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { BucketAdLibActions, BucketAdLibs, Buckets } from '../collections'

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
	export async function allowReadAccess(
		cred: Credentials | ResolvedCredentials,
		bucketId: BucketId
	): Promise<boolean> {
		check(bucketId, String)

		const bucket = await Buckets.findOneAsync(bucketId)
		if (!bucket) throw new Meteor.Error(404, `Bucket "${bucketId}" not found!`)

		return StudioReadAccess.studioContent(bucket.studioId, cred)
	}
	export async function allowWriteAccess(cred: Credentials, bucketId: BucketId): Promise<BucketContentAccess> {
		triggerWriteAccess()

		check(bucketId, String)

		const bucket = await Buckets.findOneAsync(bucketId)
		if (!bucket) throw new Meteor.Error(404, `Bucket "${bucketId}" not found!`)

		return {
			...(await StudioContentWriteAccess.bucket(cred, bucket.studioId)),
			bucket,
		}
	}
	export async function allowWriteAccessPiece(
		cred: Credentials,
		pieceId: PieceId
	): Promise<BucketAdlibPieceContentAccess> {
		triggerWriteAccess()

		check(pieceId, String)

		const bucketAdLib = await BucketAdLibs.findOneAsync(pieceId)
		if (!bucketAdLib) throw new Meteor.Error(404, `Bucket AdLib "${pieceId}" not found!`)

		return {
			...(await StudioContentWriteAccess.bucket(cred, bucketAdLib.studioId)),
			adlib: bucketAdLib,
		}
	}
	export async function allowWriteAccessAction(
		cred: Credentials,
		actionId: AdLibActionId
	): Promise<BucketAdlibActionContentAccess> {
		triggerWriteAccess()

		check(actionId, String)

		const bucketAdLibAction = await BucketAdLibActions.findOneAsync(actionId)
		if (!bucketAdLibAction) throw new Meteor.Error(404, `Bucket AdLib Actions "${actionId}" not found!`)

		return {
			...(await StudioContentWriteAccess.bucket(cred, bucketAdLibAction.studioId)),
			action: bucketAdLibAction,
		}
	}
}
