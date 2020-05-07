import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { IngestAdlib } from 'tv-automation-sofie-blueprints-integration'
import { updateBucketAdlibFromIngestData } from "../../server/api/ingest/bucketAdlibs"
import { getShowStyleCompound, ShowStyleVariantId } from "../collections/ShowStyleVariants"
import { Studios, StudioId } from "../collections/Studios"
import { Buckets, Bucket, BucketId } from "../collections/Buckets"
import { ClientAPI } from "./client"
import { BucketSecurity } from "../../server/security/buckets"
import { Omit, protectString, ProtectedString } from "../lib"
import { BucketAdLibs, BucketAdLib } from "../collections/BucketAdlibs"
import { RundownPlaylistId, RundownPlaylist, RundownPlaylists } from "../collections/RundownPlaylists"
import { PartId } from "../collections/Parts"
import { RundownHoldState } from "../collections/Rundowns"
import { BucketsAPI as ServerBucketsAPI } from "../../server/api/buckets"
import { ServerPlayoutAdLibAPI } from "../../server/api/playout/adlib"
import { PieceId } from "../collections/Pieces"
import { PartInstanceId } from "../collections/PartInstances"

export interface BucketsAPI {
	removeBucketAdLib(id: PieceId): Promise<ClientAPI.ClientResponse<void>>
	modifyBucket(id: BucketId, bucket: Partial<Omit<Bucket, '_id'>>): Promise<ClientAPI.ClientResponse<void>>
	emptyBucket(id: BucketId): Promise<ClientAPI.ClientResponse<void>>
	createNewBucket(name: string, studioId: StudioId, userId: string | null): Promise<ClientAPI.ClientResponse<Bucket>>
	removeBucket(id: BucketId): Promise<ClientAPI.ClientResponse<undefined>>
	modifyBucketAdLib(id: PieceId, newAdLib: Partial<Omit<BucketAdLib, '_id'>>): Promise<ClientAPI.ClientResponse<void>>
	bucketAdlibImport(studioId: StudioId, showStyleVariantId: ShowStyleVariantId, bucketId: BucketId, ingestItem: IngestAdlib): Promise<ClientAPI.ClientResponse<undefined>>
	bucketAdlibStart(playlistId: RundownPlaylistId, partId: PartInstanceId, bucketAdlibId: PieceId, queue?: boolean): Promise<ClientAPI.ClientResponse<void>>
}

export namespace BucketsAPIMethods {
	export function removeBucketAdLib(id: PieceId) {
		check(id, String)

		return ClientAPI.responseSuccess(ServerBucketsAPI.removeBucketAdLib(id))
	}

	export function modifyBucket(id: BucketId, bucket: Partial<Omit<Bucket, '_id'>>) {
		check(id, String)
		check(bucket, Object)

		if (BucketSecurity.allowWriteAccess(id)) {
			return ClientAPI.responseSuccess(ServerBucketsAPI.modifyBucket(id, bucket))
		}
		throw new Meteor.Error(403, 'Access denied')
	}

	export function emptyBucket(id: BucketId) {
		check(id, String)

		return ClientAPI.responseSuccess(ServerBucketsAPI.emptyBucket(id))
	}

	export function createNewBucket(name: string, studioId: StudioId, userId: string | null) {
		check(name, String)
		check(studioId, String)

		return ClientAPI.responseSuccess(ServerBucketsAPI.createNewBucket(name, studioId, this.connection.userId))
	}

	export function removeBucket(id: BucketId) {
		check(id, String)

		if (BucketSecurity.allowWriteAccess(id)) {
			ServerBucketsAPI.removeBucket(id)
			return ClientAPI.responseSuccess<undefined>(undefined)
		}
		throw new Meteor.Error(403, 'Access denied')
	}

	export function modifyBucketAdLib(id: PieceId, newAdLib: Partial<Omit<BucketAdLib, '_id'>>) {
		check(id, String)
		check(newAdLib, Object)

		const oldAdLib = BucketAdLibs.findOne(id)
		if (!oldAdLib) {
			throw new Meteor.Error(404, `Bucket AdLib not found: ${id}`)
		}

		if (!BucketSecurity.allowWriteAccess(oldAdLib.bucketId)) {
			throw new Meteor.Error(403, 'Access denied')
		}
		if (newAdLib.bucketId && !BucketSecurity.allowWriteAccess(newAdLib.bucketId)) {
			throw new Meteor.Error(403, 'Access denied')
		}

		return ClientAPI.responseSuccess(ServerBucketsAPI.modifyBucketAdLib(id, newAdLib))
	}

	export function bucketAdlibImport(studioId: StudioId, showStyleVariantId: ShowStyleVariantId, bucketId: BucketId, ingestItem: IngestAdlib) {
		check(studioId, String)
		check(showStyleVariantId, String)
		check(bucketId, String)
		// TODO - validate IngestAdlib

		const studio = Studios.findOne(studioId)
		if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" not found`)
		const showStyleCompound = getShowStyleCompound(showStyleVariantId)
		if (!showStyleCompound) throw new Meteor.Error(404, `ShowStyle Variant "${showStyleVariantId}" not found`)

		if (studio.supportedShowStyleBase.indexOf(showStyleCompound._id) === -1) {
			throw new Meteor.Error(500, `ShowStyle Variant "${showStyleVariantId}" not supported by studio "${studioId}"`)
		}

		const bucket = Buckets.findOne(bucketId)
		if (!bucket) throw new Meteor.Error(404, `Bucket "${bucketId}" not found`)

		updateBucketAdlibFromIngestData(showStyleCompound, studio, bucketId, ingestItem)

		return ClientAPI.responseSuccess<undefined>(undefined)
	}

	export function bucketAdlibStart(playlistId: RundownPlaylistId, partInstanceId: PartInstanceId, bucketAdlibId: PieceId, queue?: boolean) {
		check(playlistId, String)
		check(partInstanceId, String)
		check(bucketAdlibId, String)

		let rundown = RundownPlaylists.findOne(playlistId)
		if (!rundown) throw new Meteor.Error(404, `Rundown Playlist "${playlistId}" not found!`)
		if (!rundown.active) return ClientAPI.responseError(`The Rundown isn't active, please activate it before starting an AdLib!`)
		if (rundown.holdState === RundownHoldState.ACTIVE || rundown.holdState === RundownHoldState.PENDING) {
			return ClientAPI.responseError(`Can't start AdLibPiece when the Rundown is in Hold mode!`)
		}

		return ClientAPI.responseSuccess(
			ServerPlayoutAdLibAPI.startBucketAdlibPiece(playlistId, partInstanceId, bucketAdlibId, !!queue)
		)
	}
}
