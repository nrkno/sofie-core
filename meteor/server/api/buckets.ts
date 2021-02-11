import * as _ from 'underscore'
import { Random } from 'meteor/random'
import { Meteor } from 'meteor/meteor'
import { Buckets, Bucket, BucketId } from '../../lib/collections/Buckets'
import { asyncCollectionRemove, literal, protectString, waitForPromiseAll } from '../../lib/lib'
import { BucketSecurity } from '../security/buckets'
import { BucketAdLibs, BucketAdLib } from '../../lib/collections/BucketAdlibs'
import { ExpectedMediaItems } from '../../lib/collections/ExpectedMediaItems'
import { PieceId } from '../../lib/collections/Pieces'
import { StudioId, Studios } from '../../lib/collections/Studios'
import { ShowStyleVariants, getShowStyleCompound } from '../../lib/collections/ShowStyleVariants'
import { MethodContext } from '../../lib/api/methods'
import { OrganizationContentWriteAccess } from '../security/organization'
import { AdLibActionId, AdLibAction, AdLibActionCommon } from '../../lib/collections/AdLibActions'
import { BucketAdLibActions, BucketAdLibAction } from '../../lib/collections/BucketAdlibActions'
import { Rundowns } from '../../lib/collections/Rundowns'
import { syncFunction } from '../codeControl'
import {
	cleanUpExpectedMediaItemForBucketAdLibActions,
	cleanUpExpectedMediaItemForBucketAdLibPiece,
	updateExpectedMediaItemForBucketAdLibAction,
	updateExpectedMediaItemForBucketAdLibPiece,
} from './ingest/expectedMediaItems'

const DEFAULT_BUCKET_WIDTH = undefined

function isBucketAdLibAction(action: AdLibActionCommon | BucketAdLibAction): action is BucketAdLibAction {
	if (action['showStyleVariantId'] && action['studioId']) {
		return true
	}
	return false
}

export function bucketSyncFunction<T extends () => any>(bucketId: BucketId, context: string, fcn: T): ReturnType<T> {
	return syncFunction(fcn, context, `bucket_${bucketId}`)()
}

export namespace BucketsAPI {
	export function removeBucketAdLib(context: MethodContext, id: PieceId) {
		BucketSecurity.allowWriteAccessPiece({ _id: id }, context)

		const adlib = BucketAdLibs.findOne(id)
		if (!adlib) throw new Meteor.Error(404, `Bucket Ad-Lib not found: ${id}`)

		if (!BucketSecurity.allowWriteAccess({ _id: adlib.bucketId }, context))
			throw new Meteor.Error(403, `Not allowed to edit bucket: ${adlib.bucketId}`)

		bucketSyncFunction(adlib.bucketId, 'removeBucketAdLib', () => {
			waitForPromiseAll([
				asyncCollectionRemove(BucketAdLibs, { _id: id }),
				cleanUpExpectedMediaItemForBucketAdLibPiece([id]),
			])
		})
	}

	export function removeBucketAdLibAction(context: MethodContext, id: AdLibActionId) {
		BucketSecurity.allowWriteAccessAction({ _id: id }, context)

		const adlib = BucketAdLibActions.findOne(id)
		if (!adlib) throw new Meteor.Error(404, `Bucket Ad-Lib not found: ${id}`)

		if (!BucketSecurity.allowWriteAccess({ _id: adlib.bucketId }, context))
			throw new Meteor.Error(403, `Not allowed to edit bucket: ${adlib.bucketId}`)

		bucketSyncFunction(adlib.bucketId, 'removeBucketAdLibAction', () => {
			waitForPromiseAll([
				asyncCollectionRemove(BucketAdLibActions, { _id: id }),
				cleanUpExpectedMediaItemForBucketAdLibActions([id]),
			])
		})
	}

	export function modifyBucket(context: MethodContext, id: BucketId, bucket: Partial<Omit<Bucket, '_id'>>) {
		if (!BucketSecurity.allowWriteAccess({ _id: id }, context))
			throw new Meteor.Error(403, `Not allowed to edit bucket: ${id}`)

		const oldBucket = Buckets.findOne(id)
		if (!oldBucket) throw new Meteor.Error(404, `Bucket not found: ${id}`)

		bucketSyncFunction(id, 'modifyBucket', () => {
			Buckets.update(id, {
				$set: _.omit(bucket, ['_id']),
			})
		})
	}

	export function emptyBucket(context: MethodContext, id: BucketId) {
		if (!BucketSecurity.allowWriteAccess({ _id: id }, context))
			throw new Meteor.Error(403, `Not allowed to edit bucket: ${id}`)

		const bucket = Buckets.findOne(id)
		if (!bucket) throw new Meteor.Error(404, `Bucket not found: ${id}`)

		bucketSyncFunction(id, 'emptyBucket', () => {
			emptyBucketInner(id)
		})
	}

	function emptyBucketInner(id: BucketId) {
		waitForPromiseAll([
			asyncCollectionRemove(BucketAdLibs, { bucketId: id }),
			asyncCollectionRemove(BucketAdLibActions, { bucketId: id }),
			asyncCollectionRemove(ExpectedMediaItems, { bucketId: id }),
		])
	}

	export function createNewBucket(context: MethodContext, name: string, studioId: StudioId, userId: string | null) {
		const { studio } = OrganizationContentWriteAccess.studio(context, studioId)
		if (!studio) throw new Meteor.Error(404, `Studio not found: ${studioId}`)

		const heaviestBucket = Buckets.find(
			{
				studioId,
			},
			{
				sort: {
					_rank: 1,
				},
				fields: {
					_rank: 1,
				},
			}
		)
			.fetch()
			.reverse()[0]

		let rank = 1
		if (heaviestBucket) {
			rank = heaviestBucket._rank + 1
		}

		const newBucket = literal<Bucket>({
			_id: protectString(Random.id()),
			_rank: rank,
			name: name,
			studioId,
			userId,
			width: DEFAULT_BUCKET_WIDTH,
			buttonWidthScale: 1,
			buttonHeightScale: 1,
		})

		Buckets.insert(newBucket)

		return newBucket
	}

	export function modifyBucketAdLibAction(
		context: MethodContext,
		id: AdLibActionId,
		action: Partial<Omit<BucketAdLibAction, '_id'>>
	) {
		if (!BucketSecurity.allowWriteAccessAction({ _id: id }, context))
			throw new Meteor.Error(403, `Not allowed to edit bucket adlib: ${id}`)

		const oldAdLib = BucketAdLibActions.findOne(id)
		if (!oldAdLib) {
			throw new Meteor.Error(404, `Bucket AdLib not found: ${id}`)
		}

		if (!BucketSecurity.allowWriteAccess({ _id: oldAdLib.bucketId }, context)) {
			throw new Meteor.Error(403, 'Access denied')
		}
		if (action.bucketId && !BucketSecurity.allowWriteAccess({ _id: action.bucketId }, context)) {
			throw new Meteor.Error(403, 'Access denied')
		}

		bucketSyncFunction(action.bucketId ?? oldAdLib.bucketId, 'modifyBucketAdLib', () => {
			if (action.bucketId && !Buckets.findOne(action.bucketId)) {
				throw new Meteor.Error(`Could not find bucket: "${action.bucketId}"`)
			}

			if (action.showStyleVariantId && !ShowStyleVariants.findOne(action.showStyleVariantId)) {
				throw new Meteor.Error(`Could not find show style variant: "${action.showStyleVariantId}"`)
			}

			if (action.studioId && !Studios.findOne(action.studioId)) {
				throw new Meteor.Error(`Could not find studio: "${action.studioId}"`)
			}

			BucketAdLibActions.update(id, {
				$set: _.omit(action, ['_id']),
			})
			updateExpectedMediaItemForBucketAdLibAction(id)
		})
	}

	export function saveAdLibActionIntoBucket(
		context: MethodContext,
		studioId: StudioId,
		action: AdLibActionCommon | BucketAdLibAction,
		bucketId: BucketId
	): BucketAdLibAction {
		if (bucketId && !BucketSecurity.allowWriteAccess({ _id: bucketId }, context)) {
			throw new Meteor.Error(403, 'Access denied')
		}

		let adLibAction: BucketAdLibAction
		if (isBucketAdLibAction(action)) {
			if (action.showStyleVariantId && !ShowStyleVariants.findOne(action.showStyleVariantId)) {
				throw new Meteor.Error(`Could not find show style variant: "${action.showStyleVariantId}"`)
			}

			const studio = Studios.findOne(studioId)
			if (!studio) {
				throw new Meteor.Error(`Could not find studio: "${studioId}"`)
			}

			if (studio._id !== action.studioId) {
				throw new Meteor.Error(
					`studioId is different than Action's studioId: "${studioId}" - "${action.studioId}"`
				)
			}

			adLibAction = {
				...action,
				_id: protectString(Random.id()),
				bucketId: bucketId,
			}
		} else {
			const rundown = Rundowns.findOne(action.rundownId)
			if (!rundown) {
				throw new Meteor.Error(`Could not find rundown: "${action.rundownId}"`)
			}

			if (rundown.showStyleVariantId && !ShowStyleVariants.findOne(rundown.showStyleVariantId)) {
				throw new Meteor.Error(`Could not find show style variant: "${rundown.showStyleVariantId}"`)
			}

			const studio = Studios.findOne(studioId)
			if (!studio) {
				throw new Meteor.Error(`Could not find studio: "${studioId}"`)
			}

			if (studio._id !== rundown.studioId) {
				throw new Meteor.Error(
					`studioId is different than Rundown's studioId: "${studioId}" - "${rundown.studioId}"`
				)
			}

			const showStyleCompound = getShowStyleCompound(rundown.showStyleVariantId)
			if (!showStyleCompound)
				throw new Meteor.Error(404, `ShowStyle Variant "${rundown.showStyleVariantId}" not found`)

			if (studio.supportedShowStyleBase.indexOf(showStyleCompound._id) === -1) {
				throw new Meteor.Error(
					500,
					`ShowStyle Variant "${rundown.showStyleVariantId}" not supported by studio "${studioId}"`
				)
			}

			adLibAction = {
				...(_.omit(action, ['partId', 'rundownId']) as Omit<AdLibAction, 'partId' | 'rundownId'>),
				_id: protectString(Random.id()),
				externalId: '', // TODO - is this ok?
				bucketId: bucketId,
				studioId: studioId,
				showStyleVariantId: rundown.showStyleVariantId,
				importVersions: rundown.importVersions,
			}
		}

		bucketSyncFunction(adLibAction.bucketId, 'saveAdLibActionIntoBucket', () => {
			BucketAdLibActions.insert(adLibAction)
			updateExpectedMediaItemForBucketAdLibAction(adLibAction._id)
		})

		return adLibAction
	}

	export function modifyBucketAdLib(context: MethodContext, id: PieceId, adlib: Partial<Omit<BucketAdLib, '_id'>>) {
		if (!BucketSecurity.allowWriteAccessPiece({ _id: id }, context))
			throw new Meteor.Error(403, `Not allowed to edit bucket adlib: ${id}`)

		const oldAdLib = BucketAdLibs.findOne(id)
		if (!oldAdLib) {
			throw new Meteor.Error(404, `Bucket AdLib not found: ${id}`)
		}

		if (!BucketSecurity.allowWriteAccess({ _id: oldAdLib.bucketId }, context)) {
			throw new Meteor.Error(403, 'Access denied')
		}
		if (adlib.bucketId && !BucketSecurity.allowWriteAccess({ _id: adlib.bucketId }, context)) {
			throw new Meteor.Error(403, 'Access denied')
		}

		bucketSyncFunction(adlib.bucketId ?? oldAdLib.bucketId, 'modifyBucketAdLib', () => {
			if (adlib.bucketId && !Buckets.findOne(adlib.bucketId)) {
				throw new Meteor.Error(`Could not find bucket: "${adlib.bucketId}"`)
			}

			if (adlib.showStyleVariantId && !ShowStyleVariants.findOne(adlib.showStyleVariantId)) {
				throw new Meteor.Error(`Could not find show style variant: "${adlib.showStyleVariantId}"`)
			}

			if (adlib.studioId && !Studios.findOne(adlib.studioId)) {
				throw new Meteor.Error(`Could not find studio: "${adlib.studioId}"`)
			}

			BucketAdLibs.update(id, {
				$set: _.omit(adlib, ['_id']),
			})
			updateExpectedMediaItemForBucketAdLibPiece(id)
		})
	}

	export function removeBucket(context: MethodContext, id: BucketId) {
		if (!BucketSecurity.allowWriteAccess({ _id: id }, context))
			throw new Meteor.Error(403, `Not allowed to edit bucket: ${id}`)

		const bucket = Buckets.findOne(id)
		if (!bucket) throw new Meteor.Error(404, `Bucket not found: ${id}`)

		bucketSyncFunction(id, 'removeBucket', () => {
			Buckets.remove(id)
			emptyBucketInner(id)
		})
	}
}
