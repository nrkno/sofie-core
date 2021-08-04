import { check, Match } from '../../lib/check'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '../../lib/api/client'
import { Awaited, getCurrentTime, getHash, makePromise } from '../../lib/lib'
import { Rundowns, RundownId } from '../../lib/collections/Rundowns'
import { Parts, PartId } from '../../lib/collections/Parts'
import { logger } from '../logging'
import { ServerPlayoutAPI } from './playout/playout'
import { NewUserActionAPI, RESTART_SALT, UserActionAPIMethods } from '../../lib/api/userActions'
import { EvaluationBase } from '../../lib/collections/Evaluations'
import { StudioId } from '../../lib/collections/Studios'
import { Pieces, PieceId } from '../../lib/collections/Pieces'
import { IngestPart, IngestAdlib, ActionUserData } from '@sofie-automation/blueprints-integration'
import { storeRundownPlaylistSnapshot } from './snapshot'
import { registerClassToMeteorMethods } from '../methods'
import { ServerRundownAPI } from './rundown'
import { saveEvaluation } from './evaluations'
import { MediaManagerAPI } from './mediaManager'
import { IngestDataCache, IngestCacheType } from '../../lib/collections/IngestDataCache'
import { MOSDeviceActions } from './ingest/mosDevice/actions'
import { RundownPlaylistId } from '../../lib/collections/RundownPlaylists'
import { PartInstanceId } from '../../lib/collections/PartInstances'
import { PieceInstanceId } from '../../lib/collections/PieceInstances'
import { MediaWorkFlowId } from '../../lib/collections/MediaWorkFlows'
import { MethodContext, MethodContextAPI } from '../../lib/api/methods'
import { ServerClientAPI } from './client'
import { SegmentId, Segments } from '../../lib/collections/Segments'
import { OrganizationContentWriteAccess } from '../security/organization'
import { SystemWriteAccess } from '../security/system'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/lib/securityVerify'
import { ShowStyleVariantId } from '../../lib/collections/ShowStyleVariants'
import { BucketId, Buckets, Bucket } from '../../lib/collections/Buckets'
import { BucketsAPI } from './buckets'
import { BucketAdLib } from '../../lib/collections/BucketAdlibs'
import { rundownContentAllowWrite } from '../security/rundown'
import { profiler } from './profiler'
import { AdLibActionId, AdLibActionCommon } from '../../lib/collections/AdLibActions'
import { BucketAdLibAction } from '../../lib/collections/BucketAdlibActions'
import { checkAccessAndGetPlaylist, checkAccessAndGetRundown, checkAccessToPlaylist } from './lib'
import { PackageManagerAPI } from './packageManager'
import { PeripheralDeviceId } from '../../lib/collections/PeripheralDevices'
import { getShowStyleCompound } from './showStyles'
import { RundownBaselineAdLibActionId } from '../../lib/collections/RundownBaselineAdLibActions'
import { SnapshotId } from '../../lib/collections/Snapshots'
import { QueueStudioJob } from '../worker/worker'
import { StudioJobFunc, StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { runIngestOperation } from './ingest/lib'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'

/**
 * Run a user action via the worker. Before calling you MUST check the user is allowed to do the operation
 * @param studioId Id of the studio
 * @param name The name/id of the operation
 * @param data Data for the operation
 * @returns Wrapped 'client safe' response. Includes translatable friendly error messages
 */
async function runUserAction<T extends keyof StudioJobFunc>(
	studioId: StudioId,
	name: T,
	data: Parameters<StudioJobFunc[T]>[0]
): Promise<ClientAPI.ClientResponse<ReturnType<StudioJobFunc[T]>>> {
	try {
		const job = await QueueStudioJob(name, studioId, data)

		const span = profiler.startSpan('queued-job')
		const res = await job.complete
		span?.end()

		// TODO - track timings
		// console.log(await job.getTimings)

		return ClientAPI.responseSuccess(res)
	} catch (e) {
		console.log('raw', e, JSON.stringify(e))

		let userError: UserError
		if (UserError.isUserError(e)) {
			userError = e
		} else {
			// Rewrap errors as a UserError
			const err = e instanceof Error ? e : new Error(e)
			userError = UserError.from(err, UserErrorMessage.InternalError)
		}

		logger.error(`UserAction "${name}" failed: ${userError.rawError.toString()}`)

		// TODO - this isnt great, but is good enough for a prototype
		return ClientAPI.responseError(JSON.stringify(userError.message))
	}
}

export async function take(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId
): Promise<ClientAPI.ClientResponse<void>> {
	const access = checkAccessToPlaylist(context, rundownPlaylistId)
	const playlist = access.playlist

	return runUserAction(playlist.studioId, StudioJobs.TakeNextPart, {
		playlistId: rundownPlaylistId,
	})
}

export async function setNext(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	nextPartId: PartId | null,
	setManually?: boolean,
	nextTimeOffset?: number | undefined
): Promise<ClientAPI.ClientResponse<void>> {
	check(rundownPlaylistId, String)
	if (nextPartId) check(nextPartId, String)

	const access = checkAccessToPlaylist(context, rundownPlaylistId)
	const playlist = access.playlist

	return runUserAction(playlist.studioId, StudioJobs.SetNextPart, {
		playlistId: rundownPlaylistId,
		nextPartId,
		setManually,
		nextTimeOffset,
	})
}
export async function setNextSegment(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	nextSegmentId: SegmentId | null
): Promise<ClientAPI.ClientResponse<void>> {
	check(rundownPlaylistId, String)
	if (nextSegmentId) check(nextSegmentId, String)
	else check(nextSegmentId, null)

	const access = checkAccessToPlaylist(context, rundownPlaylistId)
	const playlist = access.playlist

	return runUserAction(playlist.studioId, StudioJobs.SetNextSegment, {
		playlistId: rundownPlaylistId,
		nextSegmentId,
	})
}
export async function moveNext(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	horisontalDelta: number,
	verticalDelta: number
): Promise<ClientAPI.ClientResponse<PartId | null>> {
	const access = checkAccessToPlaylist(context, rundownPlaylistId)
	const playlist = access.playlist

	return runUserAction(playlist.studioId, StudioJobs.MoveNextPart, {
		playlistId: rundownPlaylistId,
		partDelta: horisontalDelta,
		segmentDelta: verticalDelta,
	})
}
export async function prepareForBroadcast(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId
): Promise<ClientAPI.ClientResponse<void>> {
	check(rundownPlaylistId, String)

	const access = checkAccessToPlaylist(context, rundownPlaylistId)
	const playlist = access.playlist

	return runUserAction(playlist.studioId, StudioJobs.PrepareRundownForBroadcast, {
		playlistId: rundownPlaylistId,
	})
}
export async function resetRundownPlaylist(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId
): Promise<ClientAPI.ClientResponse<void>> {
	check(rundownPlaylistId, String)

	const access = checkAccessToPlaylist(context, rundownPlaylistId)
	const playlist = access.playlist

	return runUserAction(playlist.studioId, StudioJobs.ResetRundownPlaylist, {
		playlistId: rundownPlaylistId,
	})
}
export async function resetAndActivate(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	rehearsal?: boolean
): Promise<ClientAPI.ClientResponse<void>> {
	check(rundownPlaylistId, String)

	const access = checkAccessToPlaylist(context, rundownPlaylistId)
	const playlist = access.playlist

	return runUserAction(playlist.studioId, StudioJobs.ResetRundownPlaylist, {
		playlistId: rundownPlaylistId,
		activate: rehearsal ? 'rehearsal' : 'active',
	})
}
export async function forceResetAndActivate(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	rehearsal: boolean
): Promise<ClientAPI.ClientResponse<void>> {
	// Reset and activates a rundown, automatically deactivates any other running rundowns

	check(rehearsal, Boolean)
	const access = checkAccessToPlaylist(context, rundownPlaylistId)
	const playlist = access.playlist

	return runUserAction(playlist.studioId, StudioJobs.ResetRundownPlaylist, {
		playlistId: rundownPlaylistId,
		activate: rehearsal ? 'rehearsal' : 'active',
		forceActivate: true,
	})
}
export async function activate(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	rehearsal: boolean
): Promise<ClientAPI.ClientResponse<void>> {
	check(rundownPlaylistId, String)
	check(rehearsal, Boolean)

	const access = checkAccessToPlaylist(context, rundownPlaylistId)
	const playlist = access.playlist

	return runUserAction(playlist.studioId, StudioJobs.ActivateRundownPlaylist, {
		playlistId: rundownPlaylistId,
		rehearsal,
	})
}
export async function deactivate(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId
): Promise<ClientAPI.ClientResponse<void>> {
	const access = checkAccessToPlaylist(context, rundownPlaylistId)
	const playlist = access.playlist

	return runUserAction(playlist.studioId, StudioJobs.DeactivateRundownPlaylist, {
		playlistId: rundownPlaylistId,
	})
}
export async function unsyncRundown(
	context: MethodContext,
	rundownId: RundownId
): Promise<ClientAPI.ClientResponse<void>> {
	return ClientAPI.responseSuccess(await ServerRundownAPI.unsyncRundown(context, rundownId))
}
export async function disableNextPiece(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	undo?: boolean
): Promise<ClientAPI.ClientResponse<void>> {
	const access = checkAccessToPlaylist(context, rundownPlaylistId)
	const playlist = access.playlist

	return runUserAction(playlist.studioId, StudioJobs.DisableNextPiece, {
		playlistId: rundownPlaylistId,
		undo: !!undo,
	})
}
export async function pieceTakeNow(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	partInstanceId: PartInstanceId,
	pieceInstanceIdOrPieceIdToCopy: PieceInstanceId | PieceId
): Promise<ClientAPI.ClientResponse<void>> {
	check(rundownPlaylistId, String)
	check(partInstanceId, String)
	check(pieceInstanceIdOrPieceIdToCopy, String)

	const access = checkAccessToPlaylist(context, rundownPlaylistId)
	const playlist = access.playlist

	return runUserAction(playlist.studioId, StudioJobs.TakePieceAsAdlibNow, {
		playlistId: rundownPlaylistId,
		partInstanceId: partInstanceId,
		pieceInstanceIdOrPieceIdToCopy: pieceInstanceIdOrPieceIdToCopy,
	})
}
export async function pieceSetInOutPoints(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	partId: PartId,
	pieceId: PieceId,
	inPoint: number,
	duration: number
): Promise<ClientAPI.ClientResponse<void>> {
	check(rundownPlaylistId, String)
	check(partId, String)
	check(pieceId, String)
	check(inPoint, Number)
	check(duration, Number)

	const access = checkAccessToPlaylist(context, rundownPlaylistId)
	const playlist = access.playlist

	const part = await Parts.findOneAsync(partId)
	if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)
	if (playlist.activationId && part.status === 'PLAY') {
		throw new Meteor.Error(`Part cannot be active while setting in/out!`) // @todo: un-hardcode
	}
	const rundown = await Rundowns.findOneAsync(part.rundownId)
	if (!rundown) throw new Meteor.Error(501, `Rundown "${part.rundownId}" not found!`)

	const partCache = await IngestDataCache.findOneAsync({
		rundownId: rundown._id,
		partId: part._id,
		type: IngestCacheType.PART,
	})
	if (!partCache) throw new Meteor.Error(404, `Part Cache for "${partId}" not found!`)
	const piece = await Pieces.findOneAsync(pieceId)
	if (!piece) throw new Meteor.Error(404, `Piece "${pieceId}" not found!`)

	// TODO: replace this with a general, non-MOS specific method
	try {
		await MOSDeviceActions.setPieceInOutPoint(
			rundown,
			piece,
			partCache.data as IngestPart,
			inPoint / 1000,
			duration / 1000
		) // MOS data is in seconds
		return ClientAPI.responseSuccess(undefined)
	} catch (error) {
		return ClientAPI.responseError(error)
	}
}
export async function executeAction(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	actionDocId: AdLibActionId | RundownBaselineAdLibActionId,
	actionId: string,
	userData: any,
	triggerMode?: string
): Promise<ClientAPI.ClientResponse<void>> {
	check(rundownPlaylistId, String)
	check(actionDocId, String)
	check(actionId, String)
	check(userData, Match.Any)
	check(triggerMode, Match.Maybe(String))

	const access = checkAccessToPlaylist(context, rundownPlaylistId)
	const playlist = access.playlist

	return runUserAction(playlist.studioId, StudioJobs.ExecuteAction, {
		playlistId: rundownPlaylistId,
		actionDocId,
		actionId,
		userData,
		triggerMode,
	})
}
export async function segmentAdLibPieceStart(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	partInstanceId: PartInstanceId,
	adlibPieceId: PieceId,
	queue: boolean
): Promise<ClientAPI.ClientResponse<void>> {
	check(rundownPlaylistId, String)
	check(partInstanceId, String)
	check(adlibPieceId, String)

	const access = checkAccessToPlaylist(context, rundownPlaylistId)
	const playlist = access.playlist

	return runUserAction(playlist.studioId, StudioJobs.AdlibPieceStart, {
		playlistId: rundownPlaylistId,
		partInstanceId: partInstanceId,
		adLibPieceId: adlibPieceId,
		pieceType: 'normal',
		queue: !!queue,
	})
}
export async function sourceLayerOnPartStop(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	partInstanceId: PartInstanceId,
	sourceLayerIds: string[]
): Promise<ClientAPI.ClientResponse<void>> {
	check(rundownPlaylistId, String)
	check(partInstanceId, String)
	check(sourceLayerIds, Array)

	const access = checkAccessToPlaylist(context, rundownPlaylistId)
	const playlist = access.playlist

	return runUserAction(playlist.studioId, StudioJobs.StopPiecesOnSourceLayers, {
		playlistId: rundownPlaylistId,
		partInstanceId: partInstanceId,
		sourceLayerIds: sourceLayerIds,
	})
}
export async function rundownBaselineAdLibPieceStart(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	partInstanceId: PartInstanceId,
	adlibPieceId: PieceId,
	queue: boolean
): Promise<ClientAPI.ClientResponse<void>> {
	check(rundownPlaylistId, String)
	check(partInstanceId, String)
	check(adlibPieceId, String)

	const access = checkAccessToPlaylist(context, rundownPlaylistId)
	const playlist = access.playlist

	return runUserAction(playlist.studioId, StudioJobs.AdlibPieceStart, {
		playlistId: rundownPlaylistId,
		partInstanceId: partInstanceId,
		adLibPieceId: adlibPieceId,
		pieceType: 'baseline',
		queue: !!queue,
	})
}
export async function sourceLayerStickyPieceStart(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	sourceLayerId: string
): Promise<ClientAPI.ClientResponse<void>> {
	check(rundownPlaylistId, String)
	check(sourceLayerId, String)

	const access = checkAccessToPlaylist(context, rundownPlaylistId)
	const playlist = access.playlist

	return runUserAction(playlist.studioId, StudioJobs.StartStickyPieceOnSourceLayer, {
		playlistId: rundownPlaylistId,
		sourceLayerId: sourceLayerId,
	})
}
export async function activateHold(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	undo?: boolean
): Promise<ClientAPI.ClientResponse<void>> {
	check(rundownPlaylistId, String)

	const access = checkAccessToPlaylist(context, rundownPlaylistId)
	const playlist = access.playlist

	if (undo) {
		return runUserAction(playlist.studioId, StudioJobs.DeactivateHold, {
			playlistId: rundownPlaylistId,
		})
	} else {
		return runUserAction(playlist.studioId, StudioJobs.ActivateHold, {
			playlistId: rundownPlaylistId,
		})
	}
}
export function userSaveEvaluation(context: MethodContext, evaluation: EvaluationBase): ClientAPI.ClientResponse<void> {
	return ClientAPI.responseSuccess(saveEvaluation(context, evaluation))
}
export async function userStoreRundownSnapshot(
	context: MethodContext,
	playlistId: RundownPlaylistId,
	reason: string
): Promise<ClientAPI.ClientResponse<SnapshotId>> {
	return ClientAPI.responseSuccess(await storeRundownPlaylistSnapshot(context, playlistId, reason))
}
export async function removeRundownPlaylist(context: MethodContext, playlistId: RundownPlaylistId) {
	const playlist = checkAccessAndGetPlaylist(context, playlistId)

	logger.info('removeRundownPlaylist ' + playlistId)

	const job = await QueueStudioJob(StudioJobs.RemovePlaylist, playlist.studioId, {
		playlistId,
	})
	return ClientAPI.responseSuccess(await job.complete)
}
export function resyncRundownPlaylist(context: MethodContext, playlistId: RundownPlaylistId) {
	const playlist = checkAccessAndGetPlaylist(context, playlistId)

	return ClientAPI.responseSuccess(ServerRundownAPI.resyncRundownPlaylist(context, playlist._id))
}
export async function removeRundown(context: MethodContext, rundownId: RundownId) {
	const rundown = checkAccessAndGetRundown(context, rundownId)

	return ClientAPI.responseSuccess(await ServerRundownAPI.removeRundown(context, rundown._id))
}
export function resyncRundown(context: MethodContext, rundownId: RundownId) {
	const rundown = checkAccessAndGetRundown(context, rundownId)

	return ClientAPI.responseSuccess(ServerRundownAPI.resyncRundown(context, rundown._id))
}
export function resyncSegment(context: MethodContext, rundownId: RundownId, segmentId: SegmentId) {
	rundownContentAllowWrite(context.userId, { rundownId })
	const segment = Segments.findOne(segmentId)
	if (!segment) throw new Meteor.Error(404, `Rundown "${segmentId}" not found!`)

	return ClientAPI.responseSuccess(ServerRundownAPI.resyncSegment(context, segment.rundownId, segmentId))
}
export function mediaRestartWorkflow(context: MethodContext, workflowId: MediaWorkFlowId) {
	return ClientAPI.responseSuccess(MediaManagerAPI.restartWorkflow(context, workflowId))
}
export function mediaAbortWorkflow(context: MethodContext, workflowId: MediaWorkFlowId) {
	return ClientAPI.responseSuccess(MediaManagerAPI.abortWorkflow(context, workflowId))
}
export function mediaPrioritizeWorkflow(context: MethodContext, workflowId: MediaWorkFlowId) {
	return ClientAPI.responseSuccess(MediaManagerAPI.prioritizeWorkflow(context, workflowId))
}
export function mediaRestartAllWorkflows(context: MethodContext) {
	const access = OrganizationContentWriteAccess.anyContent(context)
	return ClientAPI.responseSuccess(MediaManagerAPI.restartAllWorkflows(context, access.organizationId))
}
export function mediaAbortAllWorkflows(context: MethodContext) {
	const access = OrganizationContentWriteAccess.anyContent(context)
	return ClientAPI.responseSuccess(MediaManagerAPI.abortAllWorkflows(context, access.organizationId))
}
export function packageManagerRestartExpectation(context: MethodContext, deviceId: PeripheralDeviceId, workId: string) {
	return ClientAPI.responseSuccess(PackageManagerAPI.restartExpectation(context, deviceId, workId))
}
export function packageManagerRestartAllExpectations(context: MethodContext, studioId: StudioId) {
	return ClientAPI.responseSuccess(PackageManagerAPI.restartAllExpectationsInStudio(context, studioId))
}
export function packageManagerAbortExpectation(context: MethodContext, deviceId: PeripheralDeviceId, workId: string) {
	return ClientAPI.responseSuccess(PackageManagerAPI.abortExpectation(context, deviceId, workId))
}
export async function bucketsRemoveBucket(context: MethodContext, id: BucketId) {
	check(id, String)

	await BucketsAPI.removeBucket(context, id)

	return ClientAPI.responseSuccess(undefined)
}
export async function bucketsModifyBucket(context: MethodContext, id: BucketId, bucket: Partial<Omit<Bucket, '_id'>>) {
	check(id, String)
	check(bucket, Object)

	await BucketsAPI.modifyBucket(context, id, bucket)

	return ClientAPI.responseSuccess(undefined)
}
export async function bucketsEmptyBucket(context: MethodContext, id: BucketId) {
	check(id, String)

	await BucketsAPI.emptyBucket(context, id)

	return ClientAPI.responseSuccess(undefined)
}
export async function bucketsCreateNewBucket(
	context: MethodContext,
	name: string,
	studioId: StudioId,
	userId: string | null
) {
	check(name, String)
	check(studioId, String)

	const bucket = await BucketsAPI.createNewBucket(context, name, studioId, userId)

	return ClientAPI.responseSuccess(bucket)
}
export async function bucketsRemoveBucketAdLib(context: MethodContext, id: PieceId) {
	check(id, String)

	await BucketsAPI.removeBucketAdLib(context, id)

	return ClientAPI.responseSuccess(undefined)
}
export async function bucketsRemoveBucketAdLibAction(context: MethodContext, id: AdLibActionId) {
	check(id, String)

	await BucketsAPI.removeBucketAdLibAction(context, id)

	return ClientAPI.responseSuccess(undefined)
}
export async function bucketsModifyBucketAdLib(
	context: MethodContext,
	id: PieceId,
	adlib: Partial<Omit<BucketAdLib, '_id'>>
) {
	check(id, String)
	check(adlib, Object)

	await BucketsAPI.modifyBucketAdLib(context, id, adlib)

	return ClientAPI.responseSuccess(undefined)
}
export async function bucketsModifyBucketAdLibAction(
	context: MethodContext,
	id: AdLibActionId,
	action: Partial<Omit<BucketAdLibAction, '_id'>>
) {
	check(id, String)
	check(action, Object)

	await BucketsAPI.modifyBucketAdLibAction(context, id, action)

	return ClientAPI.responseSuccess(undefined)
}
export function regenerateRundownPlaylist(context: MethodContext, rundownPlaylistId: RundownPlaylistId) {
	check(rundownPlaylistId, String)

	const access = checkAccessToPlaylist(context, rundownPlaylistId)
	const playlist = access.playlist

	if (playlist.activationId) {
		return ClientAPI.responseError(`Rundown Playlist is active, please deactivate it before regenerating it.`)
	}

	return runUserAction(playlist.studioId, StudioJobs.RegeneratePlaylist, {
		playlistId: playlist._id,
		purgeExisting: false,
	})
}

export async function bucketAdlibImport(
	context: MethodContext,
	studioId: StudioId,
	showStyleVariantId: ShowStyleVariantId,
	bucketId: BucketId,
	ingestItem: IngestAdlib
): Promise<ClientAPI.ClientResponse<undefined>> {
	const { studio } = OrganizationContentWriteAccess.studio(context, studioId)

	check(studioId, String)
	check(showStyleVariantId, String)
	check(bucketId, String)
	// TODO - validate IngestAdlib

	if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" not found`)
	const showStyleCompound = await getShowStyleCompound(showStyleVariantId)
	if (!showStyleCompound) throw new Meteor.Error(404, `ShowStyle Variant "${showStyleVariantId}" not found`)

	if (studio.supportedShowStyleBase.indexOf(showStyleCompound._id) === -1) {
		throw new Meteor.Error(500, `ShowStyle Variant "${showStyleVariantId}" not supported by studio "${studioId}"`)
	}

	const bucket = await Buckets.findOneAsync(bucketId)
	if (!bucket) throw new Meteor.Error(404, `Bucket "${bucketId}" not found`)

	await runIngestOperation(bucket.studioId, IngestJobs.BucketItemImport, {
		bucketId: bucket._id,
		showStyleVariantId: showStyleVariantId,
		payload: ingestItem,
	})

	return ClientAPI.responseSuccess(undefined)
}

export async function bucketsSaveActionIntoBucket(
	context: MethodContext,
	studioId: StudioId,
	action: AdLibActionCommon | BucketAdLibAction,
	bucketId: BucketId
) {
	check(studioId, String)
	check(bucketId, String)
	check(action, Object)

	const { studio } = OrganizationContentWriteAccess.studio(context, studioId)

	if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" not found`)

	const result = await BucketsAPI.saveAdLibActionIntoBucket(context, studioId, action, bucketId)
	return ClientAPI.responseSuccess(result)
}

export async function bucketAdlibStart(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	partInstanceId: PartInstanceId,
	bucketAdlibId: PieceId,
	queue?: boolean
) {
	check(rundownPlaylistId, String)
	check(partInstanceId, String)
	check(bucketAdlibId, String)

	const access = checkAccessToPlaylist(context, rundownPlaylistId)
	const playlist = access.playlist

	return runUserAction(playlist.studioId, StudioJobs.AdlibPieceStart, {
		playlistId: rundownPlaylistId,
		partInstanceId: partInstanceId,
		adLibPieceId: bucketAdlibId,
		pieceType: 'bucket',
		queue: !!queue,
	})
}

let restartToken: string | undefined = undefined

export function generateRestartToken(context: MethodContext) {
	SystemWriteAccess.system(context)
	restartToken = getHash('restart_' + getCurrentTime())
	return ClientAPI.responseSuccess(restartToken)
}

export function restartCore(
	context: MethodContext,
	hashedRestartToken: string
): ClientAPI.ClientResponseSuccess<string> {
	check(hashedRestartToken, String)

	SystemWriteAccess.system(context)

	if (hashedRestartToken !== getHash(RESTART_SALT + restartToken)) {
		throw new Meteor.Error(401, `Restart token is invalid`)
	}

	setTimeout(() => {
		// eslint-disable-next-line no-process-exit
		process.exit(0)
	}, 3000)
	return ClientAPI.responseSuccess(`Restarting Core in 3s.`)
}

export function noop(_context: MethodContext) {
	triggerWriteAccessBecauseNoCheckNecessary()
	return ClientAPI.responseSuccess(undefined)
}

export function switchRouteSet(
	context: MethodContext,
	studioId: StudioId,
	routeSetId: string,
	state: boolean
): ClientAPI.ClientResponse<void> {
	check(studioId, String)
	check(routeSetId, String)
	check(state, Boolean)

	return ServerPlayoutAPI.switchRouteSet(context, studioId, routeSetId, state)
}

export async function moveRundown(
	context: MethodContext,
	rundownId: RundownId,
	intoPlaylistId: RundownPlaylistId | null,
	rundownsIdsInPlaylistInOrder: RundownId[]
): Promise<ClientAPI.ClientResponse<void>> {
	check(rundownId, String)
	if (intoPlaylistId) check(intoPlaylistId, String)

	const rundown = checkAccessAndGetRundown(context, rundownId)

	return runUserAction(rundown.studioId, StudioJobs.OrderMoveRundownToPlaylist, {
		rundownId: rundownId,
		intoPlaylistId,
		rundownsIdsInPlaylistInOrder: rundownsIdsInPlaylistInOrder,
	})
}
export async function restoreRundownOrder(
	context: MethodContext,
	playlistId: RundownPlaylistId
): Promise<ClientAPI.ClientResponse<void>> {
	check(playlistId, String)

	const access = checkAccessToPlaylist(context, playlistId)
	const playlist = access.playlist

	return runUserAction(playlist.studioId, StudioJobs.OrderRestoreToDefault, {
		playlistId: playlist._id,
	})
}

export async function traceAction<T extends (...args: any[]) => any>(
	description: string,
	fn: T,
	...args: Parameters<T>
): Promise<Awaited<ReturnType<T>>> {
	const transaction = profiler.startTransaction(description, 'userAction')
	const res = await fn(...args)
	if (transaction) transaction.end()
	return res
}

class ServerUserActionAPI extends MethodContextAPI implements NewUserActionAPI {
	async take(_userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		return traceAction(UserActionAPIMethods.take, take, this, rundownPlaylistId)
	}
	async setNext(_userEvent: string, rundownPlaylistId: RundownPlaylistId, partId: PartId, timeOffset?: number) {
		return traceAction(UserActionAPIMethods.setNext, setNext, this, rundownPlaylistId, partId, true, timeOffset)
	}
	async setNextSegment(_userEvent: string, rundownPlaylistId: RundownPlaylistId, segmentId: SegmentId) {
		return traceAction(UserActionAPIMethods.setNextSegment, setNextSegment, this, rundownPlaylistId, segmentId)
	}
	async moveNext(
		_userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		horisontalDelta: number,
		verticalDelta: number
	) {
		return traceAction(
			UserActionAPIMethods.moveNext,
			moveNext,
			this,
			rundownPlaylistId,
			horisontalDelta,
			verticalDelta
		)
	}
	async prepareForBroadcast(_userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		return traceAction(UserActionAPIMethods.prepareForBroadcast, prepareForBroadcast, this, rundownPlaylistId)
	}
	async resetRundownPlaylist(_userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		return traceAction(UserActionAPIMethods.resetRundownPlaylist, resetRundownPlaylist, this, rundownPlaylistId)
	}
	async resetAndActivate(_userEvent: string, rundownPlaylistId: RundownPlaylistId, rehearsal?: boolean) {
		return traceAction(UserActionAPIMethods.resetAndActivate, resetAndActivate, this, rundownPlaylistId, rehearsal)
	}
	async activate(_userEvent: string, rundownPlaylistId: RundownPlaylistId, rehearsal: boolean) {
		return traceAction(UserActionAPIMethods.activate, activate, this, rundownPlaylistId, rehearsal)
	}
	async deactivate(_userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		return traceAction(UserActionAPIMethods.deactivate, deactivate, this, rundownPlaylistId)
	}
	async forceResetAndActivate(_userEvent: string, rundownPlaylistId: RundownPlaylistId, rehearsal: boolean) {
		return traceAction(
			UserActionAPIMethods.forceResetAndActivate,
			forceResetAndActivate,
			this,
			rundownPlaylistId,
			rehearsal
		)
	}
	async unsyncRundown(_userEvent: string, rundownId: RundownId) {
		return traceAction(UserActionAPIMethods.unsyncRundown, unsyncRundown, this, rundownId)
	}
	async disableNextPiece(_userEvent: string, rundownPlaylistId: RundownPlaylistId, undo?: boolean) {
		return traceAction(UserActionAPIMethods.disableNextPiece, disableNextPiece, this, rundownPlaylistId, undo)
	}
	async pieceTakeNow(
		_userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		pieceInstanceIdOrPieceIdToCopy: PieceInstanceId | PieceId
	) {
		return traceAction(
			UserActionAPIMethods.pieceTakeNow,
			pieceTakeNow,
			this,
			rundownPlaylistId,
			partInstanceId,
			pieceInstanceIdOrPieceIdToCopy
		)
	}
	async setInOutPoints(
		_userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partId: PartId,
		pieceId: PieceId,
		inPoint: number,
		duration: number
	) {
		return pieceSetInOutPoints(this, rundownPlaylistId, partId, pieceId, inPoint, duration)
	}
	async executeAction(
		_userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		actionDocId: AdLibActionId | RundownBaselineAdLibActionId,
		actionId: string,
		userData: ActionUserData,
		triggerMode?: string
	) {
		return traceAction(
			UserActionAPIMethods.executeAction,
			executeAction,
			this,
			rundownPlaylistId,
			actionDocId,
			actionId,
			userData,
			triggerMode
		)
	}
	async segmentAdLibPieceStart(
		_userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		adlibPieceId: PieceId,
		queue: boolean
	) {
		return traceAction(
			UserActionAPIMethods.segmentAdLibPieceStart,
			segmentAdLibPieceStart,
			this,
			rundownPlaylistId,
			partInstanceId,
			adlibPieceId,
			queue
		)
	}
	async sourceLayerOnPartStop(
		_userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		sourceLayerIds: string[]
	) {
		return traceAction(
			UserActionAPIMethods.sourceLayerOnPartStop,
			sourceLayerOnPartStop,
			this,
			rundownPlaylistId,
			partInstanceId,
			sourceLayerIds
		)
	}
	async baselineAdLibPieceStart(
		_userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		adlibPieceId: PieceId,
		queue: boolean
	) {
		return traceAction(
			UserActionAPIMethods.baselineAdLibPieceStart,
			rundownBaselineAdLibPieceStart,
			this,
			rundownPlaylistId,
			partInstanceId,
			adlibPieceId,
			queue
		)
	}
	async sourceLayerStickyPieceStart(_userEvent: string, rundownPlaylistId: RundownPlaylistId, sourceLayerId: string) {
		return traceAction(
			UserActionAPIMethods.sourceLayerStickyPieceStart,
			sourceLayerStickyPieceStart,
			this,
			rundownPlaylistId,
			sourceLayerId
		)
	}
	async bucketAdlibImport(
		_userEvent: string,
		studioId: StudioId,
		showStyleVariantId: ShowStyleVariantId,
		bucketId: BucketId,
		ingestItem: IngestAdlib
	) {
		return traceAction(
			UserActionAPIMethods.bucketAdlibImport,
			bucketAdlibImport,
			this,
			studioId,
			showStyleVariantId,
			bucketId,
			ingestItem
		)
	}
	async bucketAdlibStart(
		_userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		bucketAdlibId: PieceId,
		queue?: boolean
	) {
		return traceAction(
			UserActionAPIMethods.bucketAdlibStart,
			bucketAdlibStart,
			this,
			rundownPlaylistId,
			partInstanceId,
			bucketAdlibId,
			queue
		)
	}
	async activateHold(_userEvent: string, rundownPlaylistId: RundownPlaylistId, undo?: boolean) {
		return traceAction(UserActionAPIMethods.activateHold, activateHold, this, rundownPlaylistId, undo)
	}
	async saveEvaluation(_userEvent: string, evaluation: EvaluationBase) {
		return makePromise(() => userSaveEvaluation(this, evaluation))
	}
	async storeRundownSnapshot(_userEvent: string, playlistId: RundownPlaylistId, reason: string) {
		return traceAction(
			UserActionAPIMethods.storeRundownSnapshot,
			userStoreRundownSnapshot,
			this,
			playlistId,
			reason
		)
	}
	async removeRundownPlaylist(_userEvent: string, playlistId: RundownPlaylistId) {
		return traceAction(UserActionAPIMethods.removeRundownPlaylist, removeRundownPlaylist, this, playlistId)
	}
	async resyncRundownPlaylist(_userEvent: string, playlistId: RundownPlaylistId) {
		return traceAction(UserActionAPIMethods.resyncRundownPlaylist, resyncRundownPlaylist, this, playlistId)
	}
	async removeRundown(_userEvent: string, rundownId: RundownId) {
		return traceAction(UserActionAPIMethods.removeRundown, removeRundown, this, rundownId)
	}
	async resyncRundown(_userEvent: string, rundownId: RundownId) {
		return traceAction(UserActionAPIMethods.resyncRundown, resyncRundown, this, rundownId)
	}
	async resyncSegment(_userEvent: string, rundownId: RundownId, segmentId: SegmentId) {
		return traceAction(UserActionAPIMethods.resyncSegment, resyncSegment, this, rundownId, segmentId)
	}
	async mediaRestartWorkflow(_userEvent: string, workflowId: MediaWorkFlowId) {
		return makePromise(() => mediaRestartWorkflow(this, workflowId))
	}
	async mediaAbortWorkflow(_userEvent: string, workflowId: MediaWorkFlowId) {
		return makePromise(() => mediaAbortWorkflow(this, workflowId))
	}
	async mediaPrioritizeWorkflow(_userEvent: string, workflowId: MediaWorkFlowId) {
		return makePromise(() => mediaPrioritizeWorkflow(this, workflowId))
	}
	async mediaRestartAllWorkflows(_userEvent: string) {
		return makePromise(() => mediaRestartAllWorkflows(this))
	}
	async mediaAbortAllWorkflows(_userEvent: string) {
		return makePromise(() => mediaAbortAllWorkflows(this))
	}
	async packageManagerRestartExpectation(_userEvent: string, deviceId: PeripheralDeviceId, workId: string) {
		return makePromise(() => packageManagerRestartExpectation(this, deviceId, workId))
	}
	async packageManagerRestartAllExpectations(_userEvent: string, studioId: StudioId) {
		return makePromise(() => packageManagerRestartAllExpectations(this, studioId))
	}
	async packageManagerAbortExpectation(_userEvent: string, deviceId: PeripheralDeviceId, workId: string) {
		return makePromise(() => packageManagerAbortExpectation(this, deviceId, workId))
	}
	async regenerateRundownPlaylist(_userEvent: string, playlistId: RundownPlaylistId) {
		return traceAction(UserActionAPIMethods.regenerateRundownPlaylist, regenerateRundownPlaylist, this, playlistId)
	}
	async generateRestartToken(_userEvent: string) {
		return makePromise(() => generateRestartToken(this))
	}
	async restartCore(_userEvent: string, token: string) {
		return makePromise(() => restartCore(this, token))
	}
	async guiFocused(_userEvent: string, _viewInfo: any[]) {
		return traceAction('userAction.noop', noop, this)
	}
	async guiBlurred(_userEvent: string, _viewInfo: any[]) {
		return traceAction('userAction.noop', noop, this)
	}
	async bucketsRemoveBucket(_userEvent: string, id: BucketId) {
		return traceAction(UserActionAPIMethods.bucketsRemoveBucket, bucketsRemoveBucket, this, id)
	}
	async bucketsModifyBucket(_userEvent: string, id: BucketId, bucket: Partial<Omit<Bucket, '_id'>>) {
		return traceAction(UserActionAPIMethods.bucketsModifyBucket, bucketsModifyBucket, this, id, bucket)
	}
	async bucketsEmptyBucket(_userEvent: string, id: BucketId) {
		return traceAction(UserActionAPIMethods.bucketsEmptyBucket, bucketsEmptyBucket, this, id)
	}
	async bucketsCreateNewBucket(_userEvent: string, name: string, studioId: StudioId, userId: string | null) {
		return traceAction(
			UserActionAPIMethods.bucketsCreateNewBucket,
			bucketsCreateNewBucket,
			this,
			name,
			studioId,
			userId
		)
	}
	async bucketsRemoveBucketAdLib(_userEvent: string, id: PieceId) {
		return traceAction(UserActionAPIMethods.bucketsRemoveBucketAdLib, bucketsRemoveBucketAdLib, this, id)
	}
	async bucketsRemoveBucketAdLibAction(_userEvent: string, id: AdLibActionId) {
		return traceAction(
			UserActionAPIMethods.bucketsRemoveBucketAdLibAction,
			bucketsRemoveBucketAdLibAction,
			this,
			id
		)
	}
	async bucketsModifyBucketAdLib(_userEvent: string, id: PieceId, bucketAdlib: Partial<Omit<BucketAdLib, '_id'>>) {
		return traceAction(
			UserActionAPIMethods.bucketsModifyBucketAdLib,
			bucketsModifyBucketAdLib,
			this,
			id,
			bucketAdlib
		)
	}
	async bucketsModifyBucketAdLibAction(
		_userEvent: string,
		id: AdLibActionId,
		bucketAdlibAction: Partial<Omit<BucketAdLibAction, '_id'>>
	) {
		return traceAction(
			UserActionAPIMethods.bucketsModifyBucketAdLibAction,
			bucketsModifyBucketAdLibAction,
			this,
			id,
			bucketAdlibAction
		)
	}
	async bucketsSaveActionIntoBucket(
		_userEvent: string,
		studioId: StudioId,
		action: AdLibActionCommon | BucketAdLibAction,
		bucketId: BucketId
	): Promise<ClientAPI.ClientResponse<BucketAdLibAction>> {
		return traceAction(
			UserActionAPIMethods.bucketsSaveActionIntoBucket,
			bucketsSaveActionIntoBucket,
			this,
			studioId,
			action,
			bucketId
		)
	}
	async switchRouteSet(
		_userEvent: string,
		studioId: StudioId,
		routeSetId: string,
		state: boolean
	): Promise<ClientAPI.ClientResponse<void>> {
		return traceAction(UserActionAPIMethods.switchRouteSet, switchRouteSet, this, studioId, routeSetId, state)
	}
	async moveRundown(
		_userEvent: string,
		rundownId: RundownId,
		intoPlaylistId: RundownPlaylistId | null,
		rundownsIdsInPlaylistInOrder: RundownId[]
	): Promise<ClientAPI.ClientResponse<void>> {
		return moveRundown(this, rundownId, intoPlaylistId, rundownsIdsInPlaylistInOrder)
	}
	async restoreRundownOrder(
		_userEvent: string,
		playlistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>> {
		return restoreRundownOrder(this, playlistId)
	}
}
registerClassToMeteorMethods(
	UserActionAPIMethods,
	ServerUserActionAPI,
	false,
	(methodContext: MethodContext, methodName: string, args: any[], fcn: Function) => {
		const eventContext = args[0]
		return ServerClientAPI.runInUserLog(methodContext, eventContext, methodName, args.slice(1), () => {
			return fcn.apply(methodContext, args)
		})
	}
)
