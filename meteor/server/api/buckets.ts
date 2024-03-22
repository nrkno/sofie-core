import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { Bucket } from '../../lib/collections/Buckets'
import { getRandomId, getRandomString, literal } from '../../lib/lib'
import { BucketSecurity } from '../security/buckets'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { AdLibAction, AdLibActionCommon } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLibActions, Buckets, Rundowns, ShowStyleVariants, Studios } from '../collections'
import { runIngestOperation } from './ingest/lib'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import { StudioContentAccess } from '../security/studio'
import { Settings } from '../../lib/Settings'
import { IngestAdlib } from '@sofie-automation/blueprints-integration'
import { getShowStyleCompound } from './showStyles'
import { ShowStyleBaseId, ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'

const DEFAULT_BUCKET_WIDTH = undefined

function isBucketAdLibAction(action: AdLibActionCommon | BucketAdLibAction): action is BucketAdLibAction {
	if ('showStyleVariantId' in action && action['showStyleVariantId'] && action['studioId']) {
		return true
	}
	return false
}

export namespace BucketsAPI {
	export async function removeBucketAdLib(access: BucketSecurity.BucketAdlibPieceContentAccess): Promise<void> {
		const adlib = access.adlib

		await runIngestOperation(adlib.studioId, IngestJobs.BucketRemoveAdlibPiece, {
			pieceId: adlib._id,
		})
	}

	export async function removeBucketAdLibAction(
		access: BucketSecurity.BucketAdlibActionContentAccess
	): Promise<void> {
		const adlib = access.action

		await runIngestOperation(adlib.studioId, IngestJobs.BucketRemoveAdlibAction, {
			actionId: adlib._id,
		})
	}

	export async function modifyBucket(
		access: BucketSecurity.BucketContentAccess,
		bucketProps: Partial<Omit<Bucket, '_id' | 'studioId'>>
	): Promise<void> {
		await Buckets.updateAsync(access.bucket._id, {
			$set: _.omit(bucketProps, ['_id', 'studioId']),
		})
	}

	export async function emptyBucket(access: BucketSecurity.BucketContentAccess): Promise<void> {
		await runIngestOperation(access.studioId, IngestJobs.BucketEmpty, {
			bucketId: access.bucket._id,
		})
	}

	export async function createNewBucket(access: StudioContentAccess, name: string): Promise<Bucket> {
		const { studio } = access

		const heaviestBucket = (
			await Buckets.findFetchAsync(
				{
					studioId: studio._id,
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
		).reverse()[0]

		let rank = 1
		if (heaviestBucket) {
			rank = heaviestBucket._rank + 1
		}

		const newBucket = literal<Bucket>({
			_id: getRandomId(),
			_rank: rank,
			name: name,
			studioId: studio._id,
			// userId,
			width: DEFAULT_BUCKET_WIDTH,
			buttonWidthScale: 1,
			buttonHeightScale: 1,
		})

		await Buckets.insertAsync(newBucket)

		return newBucket
	}

	export async function modifyBucketAdLibAction(
		access: BucketSecurity.BucketAdlibActionContentAccess,
		actionProps: Partial<Omit<BucketAdLibAction, '_id'>>
	): Promise<void> {
		const oldAction = access.action

		let moveIntoBucket: Bucket | undefined
		if (actionProps.bucketId && actionProps.bucketId !== oldAction.bucketId) {
			moveIntoBucket = await Buckets.findOneAsync(actionProps.bucketId)
			if (!moveIntoBucket) throw new Meteor.Error(`Could not find bucket: "${actionProps.bucketId}"`)
		}

		// Check we are allowed to move into the new bucket
		if (Settings.enableUserAccounts && moveIntoBucket) {
			// Shouldn't be moved across orgs
			const newBucketStudio = await Studios.findOneAsync(moveIntoBucket.studioId, {
				fields: { organizationId: 1 },
			})
			if (!newBucketStudio) throw new Meteor.Error(`Could not find studio: "${moveIntoBucket.studioId}"`)

			if (newBucketStudio.organizationId !== access.studio.organizationId) {
				throw new Meteor.Error(403, 'Access denied')
			}
		}

		await runIngestOperation(oldAction.studioId, IngestJobs.BucketActionModify, {
			actionId: oldAction._id,
			props: actionProps,
		})
	}

	export async function saveAdLibActionIntoBucket(
		access: BucketSecurity.BucketContentAccess,
		action: AdLibActionCommon | BucketAdLibAction
	): Promise<BucketAdLibAction> {
		let adLibAction: BucketAdLibAction
		if (isBucketAdLibAction(action)) {
			if (action.showStyleVariantId && !(await ShowStyleVariants.findOneAsync(action.showStyleVariantId))) {
				throw new Meteor.Error(`Could not find show style variant: "${action.showStyleVariantId}"`)
			}

			if (access.studioId !== action.studioId) {
				throw new Meteor.Error(
					`studioId is different than Action's studioId: "${access.studioId}" - "${action.studioId}"`
				)
			}

			adLibAction = {
				...action,
				_id: getRandomId(),
				bucketId: access.bucket._id,
			}
		} else {
			const rundown = await Rundowns.findOneAsync(action.rundownId)
			if (!rundown) {
				throw new Meteor.Error(`Could not find rundown: "${action.rundownId}"`)
			}

			if (access.studioId !== rundown.studioId) {
				throw new Meteor.Error(
					`studioId is different than Rundown's studioId: "${access.studioId}" - "${rundown.studioId}"`
				)
			}

			adLibAction = {
				...(_.omit(action, ['partId', 'rundownId']) as Omit<AdLibAction, 'partId' | 'rundownId'>),
				_id: getRandomId(),
				externalId: getRandomString(), // This needs to be something unique, so that the regenerate logic doesn't get it mixed up with something else
				bucketId: access.bucket._id,
				studioId: access.studioId,
				showStyleBaseId: rundown.showStyleBaseId,
				showStyleVariantId: action.allVariants ? null : rundown.showStyleVariantId,
				importVersions: rundown.importVersions,
				ingestInfo: undefined,
			}
		}

		// We can insert it here, as it is a creation with a new id, so the only race risk we have is the bucket being deleted
		await BucketAdLibActions.insertAsync(adLibAction)

		await runIngestOperation(access.studioId, IngestJobs.BucketActionRegenerateExpectedPackages, {
			actionId: adLibAction._id,
		})

		return adLibAction
	}

	export async function modifyBucketAdLib(
		access: BucketSecurity.BucketAdlibPieceContentAccess,
		adlibProps: Partial<Omit<BucketAdLib, '_id'>>
	): Promise<void> {
		const oldAdLib = access.adlib

		let moveIntoBucket: Bucket | undefined
		if (adlibProps.bucketId && adlibProps.bucketId !== oldAdLib.bucketId) {
			moveIntoBucket = await Buckets.findOneAsync(adlibProps.bucketId)
			if (!moveIntoBucket) throw new Meteor.Error(`Could not find bucket: "${adlibProps.bucketId}"`)
		}

		// Check we are allowed to move into the new bucket
		if (Settings.enableUserAccounts && moveIntoBucket) {
			// Shouldn't be moved across orgs
			const newBucketStudio = await Studios.findOneAsync(moveIntoBucket.studioId, {
				fields: { organizationId: 1 },
			})
			if (!newBucketStudio) throw new Meteor.Error(`Could not find studio: "${moveIntoBucket.studioId}"`)

			if (newBucketStudio.organizationId !== access.studio.organizationId) {
				throw new Meteor.Error(403, 'Access denied')
			}
		}

		await runIngestOperation(oldAdLib.studioId, IngestJobs.BucketPieceModify, {
			pieceId: oldAdLib._id,
			props: adlibProps,
		})
	}

	export async function removeBucket(access: BucketSecurity.BucketContentAccess): Promise<void> {
		const bucket = access.bucket
		await Promise.all([
			Buckets.removeAsync(bucket._id),
			await runIngestOperation(bucket.studioId, IngestJobs.BucketEmpty, {
				bucketId: bucket._id,
			}),
		])
	}

	export async function importAdlibToBucket(
		access: BucketSecurity.BucketContentAccess,
		showStyleBaseId: ShowStyleBaseId,
		/** Optional: if set, only create adlib for this variant (otherwise: for all variants in ShowStyleBase)*/
		showStyleVariantId: ShowStyleVariantId | undefined,
		ingestItem: IngestAdlib
	): Promise<void> {
		const studioLight = access.studio

		if (showStyleVariantId) {
			const showStyleCompound = await getShowStyleCompound(showStyleVariantId)
			if (!showStyleCompound) throw new Meteor.Error(404, `ShowStyle Variant "${showStyleVariantId}" not found`)
			if (showStyleCompound._id !== showStyleBaseId) {
				throw new Meteor.Error(
					500,
					`ShowStyle Variant "${showStyleVariantId}" is not part of ShowStyleBase "${showStyleBaseId}"`
				)
			}
		}

		if (studioLight.supportedShowStyleBase.indexOf(showStyleBaseId) === -1) {
			throw new Meteor.Error(
				500,
				`ShowStyle base "${showStyleBaseId}" not supported by studio "${access.studioId}"`
			)
		}

		await runIngestOperation(access.studioId, IngestJobs.BucketItemImport, {
			bucketId: access.bucket._id,
			showStyleBaseId: showStyleBaseId,
			showStyleVariantIds: showStyleVariantId ? [showStyleVariantId] : undefined,
			payload: ingestItem,
		})
	}
}
