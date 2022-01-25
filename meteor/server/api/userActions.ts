import { check, Match } from '../../lib/check'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '../../lib/api/client'
import { getCurrentTime, getHash } from '../../lib/lib'
import { Rundowns, RundownId } from '../../lib/collections/Rundowns'
import { Parts, PartId } from '../../lib/collections/Parts'
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
import { MethodContextAPI } from '../../lib/api/methods'
import { ServerClientAPI } from './client'
import { SegmentId } from '../../lib/collections/Segments'
import { OrganizationContentWriteAccess } from '../security/organization'
import { SystemWriteAccess } from '../security/system'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/lib/securityVerify'
import { ShowStyleVariantId } from '../../lib/collections/ShowStyleVariants'
import { BucketId, Bucket } from '../../lib/collections/Buckets'
import { BucketsAPI } from './buckets'
import { BucketAdLib } from '../../lib/collections/BucketAdlibs'
import { AdLibActionId, AdLibActionCommon } from '../../lib/collections/AdLibActions'
import { BucketAdLibAction } from '../../lib/collections/BucketAdlibActions'
import { VerifiedRundownPlaylistContentAccess } from './lib'
import { PackageManagerAPI } from './packageManager'
import { ServerPeripheralDeviceAPI } from './peripheralDevice'
import { PeripheralDeviceId } from '../../lib/collections/PeripheralDevices'
import { RundownBaselineAdLibActionId } from '../../lib/collections/RundownBaselineAdLibActions'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { PeripheralDeviceContentWriteAccess } from '../security/peripheralDevice'
import { StudioContentWriteAccess } from '../security/studio'
import { BucketSecurity } from '../security/buckets'

async function pieceSetInOutPoints(
	access: VerifiedRundownPlaylistContentAccess,
	partId: PartId,
	pieceId: PieceId,
	inPoint: number,
	duration: number
): Promise<void> {
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

	await MOSDeviceActions.setPieceInOutPoint(
		rundown,
		piece,
		partCache.data as IngestPart,
		inPoint / 1000,
		duration / 1000
	) // MOS data is in seconds
}

let restartToken: string | undefined = undefined

class ServerUserActionAPI extends MethodContextAPI implements NewUserActionAPI {
	async take(userEvent: string, rundownPlaylistId: RundownPlaylistId, fromPartInstanceId: PartInstanceId | null) {
		check(rundownPlaylistId, String)
		check(fromPartInstanceId, Match.OneOf(String, null))

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			StudioJobs.TakeNextPart,
			{
				playlistId: rundownPlaylistId,
				fromPartInstanceId,
			}
		)
	}
	async setNext(userEvent: string, rundownPlaylistId: RundownPlaylistId, nextPartId: PartId, timeOffset?: number) {
		check(rundownPlaylistId, String)
		check(nextPartId, String)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			StudioJobs.SetNextPart,
			{
				playlistId: rundownPlaylistId,
				nextPartId,
				setManually: true,
				nextTimeOffset: timeOffset,
			}
		)
	}
	async setNextSegment(userEvent: string, rundownPlaylistId: RundownPlaylistId, nextSegmentId: SegmentId | null) {
		check(rundownPlaylistId, String)
		check(nextSegmentId, Match.OneOf(String, null))

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			StudioJobs.SetNextSegment,
			{
				playlistId: rundownPlaylistId,
				nextSegmentId,
			}
		)
	}
	async moveNext(userEvent: string, rundownPlaylistId: RundownPlaylistId, partDelta: number, segmentDelta: number) {
		check(rundownPlaylistId, String)
		check(partDelta, Number)
		check(segmentDelta, Number)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			StudioJobs.MoveNextPart,
			{
				playlistId: rundownPlaylistId,
				partDelta: partDelta,
				segmentDelta: segmentDelta,
			}
		)
	}
	async prepareForBroadcast(userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		check(rundownPlaylistId, String)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			StudioJobs.PrepareRundownForBroadcast,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async resetRundownPlaylist(userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		check(rundownPlaylistId, String)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			StudioJobs.ResetRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async resetAndActivate(userEvent: string, rundownPlaylistId: RundownPlaylistId, rehearsal?: boolean) {
		check(rundownPlaylistId, String)
		check(rehearsal, Match.Optional(Boolean))

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			StudioJobs.ResetRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
				activate: rehearsal ? 'rehearsal' : 'active',
			}
		)
	}
	async activate(userEvent: string, rundownPlaylistId: RundownPlaylistId, rehearsal: boolean) {
		check(rundownPlaylistId, String)
		check(rehearsal, Boolean)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			StudioJobs.ActivateRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
				rehearsal: rehearsal,
			}
		)
	}
	async deactivate(userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		check(rundownPlaylistId, String)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			StudioJobs.DeactivateRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async forceResetAndActivate(userEvent: string, rundownPlaylistId: RundownPlaylistId, rehearsal: boolean) {
		check(rundownPlaylistId, String)
		check(rehearsal, Boolean)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			StudioJobs.ResetRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
				activate: rehearsal ? 'rehearsal' : 'active',
				forceActivate: true,
			}
		)
	}
	async disableNextPiece(userEvent: string, rundownPlaylistId: RundownPlaylistId, undo?: boolean) {
		check(rundownPlaylistId, String)
		check(undo, Match.Optional(Boolean))

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			StudioJobs.DisableNextPiece,
			{
				playlistId: rundownPlaylistId,
				undo: !!undo,
			}
		)
	}
	async pieceTakeNow(
		userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		pieceInstanceIdOrPieceIdToCopy: PieceInstanceId | PieceId
	) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)
		check(pieceInstanceIdOrPieceIdToCopy, String)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			StudioJobs.TakePieceAsAdlibNow,
			{
				playlistId: rundownPlaylistId,
				partInstanceId: partInstanceId,
				pieceInstanceIdOrPieceIdToCopy: pieceInstanceIdOrPieceIdToCopy,
			}
		)
	}
	async setInOutPoints(
		userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partId: PartId,
		pieceId: PieceId,
		inPoint: number,
		duration: number
	) {
		check(rundownPlaylistId, String)
		check(partId, String)
		check(pieceId, String)
		check(inPoint, Number)
		check(duration, Number)

		return ServerClientAPI.runUserActionInLogForPlaylist(
			this,
			userEvent,
			rundownPlaylistId,
			'pieceSetInOutPoints',
			[rundownPlaylistId, partId, pieceId, inPoint, duration],
			async (access) => {
				return pieceSetInOutPoints(access, partId, pieceId, inPoint, duration)
			}
		)
	}
	async executeAction(
		userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		actionDocId: AdLibActionId | RundownBaselineAdLibActionId,
		actionId: string,
		userData: ActionUserData,
		triggerMode?: string
	) {
		check(rundownPlaylistId, String)
		check(actionDocId, String)
		check(actionId, String)
		check(userData, Match.Any)
		check(triggerMode, Match.Optional(String))

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			StudioJobs.ExecuteAction,
			{
				playlistId: rundownPlaylistId,
				actionDocId,
				actionId,
				userData,
				triggerMode,
			}
		)
	}
	async segmentAdLibPieceStart(
		userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		adlibPieceId: PieceId,
		queue: boolean
	) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)
		check(adlibPieceId, String)
		check(queue, Boolean)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			StudioJobs.AdlibPieceStart,
			{
				playlistId: rundownPlaylistId,
				partInstanceId: partInstanceId,
				adLibPieceId: adlibPieceId,
				pieceType: 'normal',
				queue: !!queue,
			}
		)
	}
	async sourceLayerOnPartStop(
		userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		sourceLayerIds: string[]
	) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)
		check(sourceLayerIds, Array) // TODO - can we verify these are strings?

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			StudioJobs.StopPiecesOnSourceLayers,
			{
				playlistId: rundownPlaylistId,
				partInstanceId: partInstanceId,
				sourceLayerIds: sourceLayerIds,
			}
		)
	}
	async baselineAdLibPieceStart(
		userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		adlibPieceId: PieceId,
		queue: boolean
	) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)
		check(adlibPieceId, String)
		check(queue, Boolean)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			StudioJobs.AdlibPieceStart,
			{
				playlistId: rundownPlaylistId,
				partInstanceId: partInstanceId,
				adLibPieceId: adlibPieceId,
				pieceType: 'baseline',
				queue: !!queue,
			}
		)
	}
	async sourceLayerStickyPieceStart(userEvent: string, rundownPlaylistId: RundownPlaylistId, sourceLayerId: string) {
		check(rundownPlaylistId, String)
		check(sourceLayerId, String)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			StudioJobs.StartStickyPieceOnSourceLayer,
			{
				playlistId: rundownPlaylistId,
				sourceLayerId: sourceLayerId,
			}
		)
	}
	async bucketAdlibImport(
		userEvent: string,
		bucketId: BucketId,
		showStyleVariantId: ShowStyleVariantId,
		ingestItem: IngestAdlib
	) {
		check(bucketId, String)
		check(showStyleVariantId, String)
		check(ingestItem, Object)

		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'bucketAdlibImport',
			[bucketId, showStyleVariantId, ingestItem],
			async () => {
				const access = BucketSecurity.allowWriteAccess(this, bucketId)
				return BucketsAPI.importAdlibToBucket(access, showStyleVariantId, ingestItem)
			}
		)
	}
	async bucketAdlibStart(
		userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		bucketAdlibId: PieceId,
		queue?: boolean
	) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)
		check(bucketAdlibId, String)
		check(queue, Match.Optional(Boolean))

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			StudioJobs.AdlibPieceStart,
			{
				playlistId: rundownPlaylistId,
				partInstanceId: partInstanceId,
				adLibPieceId: bucketAdlibId,
				pieceType: 'bucket',
				queue: !!queue,
			}
		)
	}
	async activateHold(userEvent: string, rundownPlaylistId: RundownPlaylistId, undo?: boolean) {
		check(rundownPlaylistId, String)
		check(undo, Match.Optional(Boolean))

		if (undo) {
			return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
				this,
				userEvent,
				rundownPlaylistId,
				StudioJobs.DeactivateHold,
				{
					playlistId: rundownPlaylistId,
				}
			)
		} else {
			return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
				this,
				userEvent,
				rundownPlaylistId,
				StudioJobs.ActivateHold,
				{
					playlistId: rundownPlaylistId,
				}
			)
		}
	}
	async saveEvaluation(userEvent: string, evaluation: EvaluationBase) {
		return ServerClientAPI.runUserActionInLogForPlaylist(
			this,
			userEvent,
			evaluation.playlistId,
			'saveEvaluation',
			[evaluation],
			async (access) => {
				return saveEvaluation(access, evaluation)
			}
		)
	}
	async storeRundownSnapshot(userEvent: string, playlistId: RundownPlaylistId, reason: string) {
		return ServerClientAPI.runUserActionInLogForPlaylist(
			this,
			userEvent,
			playlistId,
			'storeRundownSnapshot',
			[playlistId, reason],
			async (access) => {
				return storeRundownPlaylistSnapshot(access, playlistId, reason)
			}
		)
	}
	async removeRundownPlaylist(userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		check(rundownPlaylistId, String)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			StudioJobs.RemovePlaylist,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async resyncRundownPlaylist(userEvent: string, playlistId: RundownPlaylistId) {
		check(playlistId, String)

		return ServerClientAPI.runUserActionInLogForPlaylist(
			this,
			userEvent,
			playlistId,
			'resyncRundownPlaylist',
			[playlistId],
			async (access) => {
				return ServerRundownAPI.resyncRundownPlaylist(access)
			}
		)
	}
	async unsyncRundown(userEvent: string, rundownId: RundownId) {
		check(rundownId, String)

		return ServerClientAPI.runUserActionInLogForRundown(
			this,
			userEvent,
			rundownId,
			'unsyncRundown',
			[rundownId],
			async (access) => {
				return ServerRundownAPI.unsyncRundown(access)
			}
		)
	}
	async removeRundown(userEvent: string, rundownId: RundownId) {
		check(rundownId, String)

		return ServerClientAPI.runUserActionInLogForRundown(
			this,
			userEvent,
			rundownId,
			'removeRundown',
			[rundownId],
			async (access) => {
				return ServerRundownAPI.removeRundown(access)
			}
		)
	}
	async resyncRundown(userEvent: string, rundownId: RundownId) {
		check(rundownId, String)

		return ServerClientAPI.runUserActionInLogForRundown(
			this,
			userEvent,
			rundownId,
			'resyncRundown',
			[rundownId],
			async (access) => {
				return ServerRundownAPI.innerResyncRundown(access.rundown)
			}
		)
	}
	async mediaRestartWorkflow(userEvent: string, workflowId: MediaWorkFlowId) {
		check(workflowId, String)

		return ServerClientAPI.runUserActionInLog(this, userEvent, 'mediaRestartWorkflow', [workflowId], async () => {
			const access = PeripheralDeviceContentWriteAccess.mediaWorkFlow(this, workflowId)
			return MediaManagerAPI.restartWorkflow(access)
		})
	}
	async mediaAbortWorkflow(userEvent: string, workflowId: MediaWorkFlowId) {
		return ServerClientAPI.runUserActionInLog(this, userEvent, 'mediaAbortWorkflow', [workflowId], async () => {
			const access = PeripheralDeviceContentWriteAccess.mediaWorkFlow(this, workflowId)
			return MediaManagerAPI.abortWorkflow(access)
		})
	}
	async mediaPrioritizeWorkflow(userEvent: string, workflowId: MediaWorkFlowId) {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'mediaPrioritizeWorkflow',
			[workflowId],
			async () => {
				const access = PeripheralDeviceContentWriteAccess.mediaWorkFlow(this, workflowId)
				return MediaManagerAPI.prioritizeWorkflow(access)
			}
		)
	}
	async mediaRestartAllWorkflows(userEvent: string) {
		return ServerClientAPI.runUserActionInLog(this, userEvent, 'mediaRestartAllWorkflows', [], async () => {
			const access = OrganizationContentWriteAccess.mediaWorkFlows(this)
			return MediaManagerAPI.restartAllWorkflows(access)
		})
	}
	async mediaAbortAllWorkflows(userEvent: string) {
		return ServerClientAPI.runUserActionInLog(this, userEvent, 'mediaAbortAllWorkflows', [], async () => {
			const access = OrganizationContentWriteAccess.mediaWorkFlows(this)
			return MediaManagerAPI.abortAllWorkflows(access)
		})
	}
	async packageManagerRestartExpectation(userEvent: string, deviceId: PeripheralDeviceId, workId: string) {
		check(deviceId, String)
		check(workId, String)

		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'packageManagerRestartExpectation',
			[deviceId, workId],
			async () => {
				const access = PeripheralDeviceContentWriteAccess.peripheralDevice(this, deviceId)
				return PackageManagerAPI.restartExpectation(access, workId)
			}
		)
	}
	async packageManagerRestartAllExpectations(userEvent: string, studioId: StudioId) {
		check(studioId, String)

		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'packageManagerRestartAllExpectations',
			[studioId],
			async () => {
				const access = StudioContentWriteAccess.anyContent(this, studioId)
				return PackageManagerAPI.restartAllExpectationsInStudio(access)
			}
		)
	}
	async packageManagerAbortExpectation(userEvent: string, deviceId: PeripheralDeviceId, workId: string) {
		check(deviceId, String)
		check(workId, String)

		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'packageManagerAbortExpectation',
			[deviceId, workId],
			async () => {
				const access = PeripheralDeviceContentWriteAccess.peripheralDevice(this, deviceId)
				return PackageManagerAPI.abortExpectation(access, workId)
			}
		)
	}
	async packageManagerRestartPackageContainer(userEvent: string, deviceId: PeripheralDeviceId, containerId: string) {
		check(deviceId, String)
		check(containerId, String)

		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'packageManagerRestartPackageContainer',
			[deviceId, containerId],
			async () => {
				const access = PeripheralDeviceContentWriteAccess.peripheralDevice(this, deviceId)
				return PackageManagerAPI.restartPackageContainer(access, containerId)
			}
		)
	}
	async regenerateRundownPlaylist(userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		check(rundownPlaylistId, String)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			StudioJobs.RegeneratePlaylist,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async generateRestartToken(userEvent: string) {
		return ServerClientAPI.runUserActionInLog(this, userEvent, 'generateRestartToken', [], async () => {
			SystemWriteAccess.system(this)
			restartToken = getHash('restart_' + getCurrentTime())
			return restartToken
		})
	}
	async restartCore(userEvent: string, hashedRestartToken: string) {
		check(hashedRestartToken, String)

		return ServerClientAPI.runUserActionInLog(this, userEvent, 'restartCore', [hashedRestartToken], async () => {
			SystemWriteAccess.system(this)

			if (hashedRestartToken !== getHash(RESTART_SALT + restartToken)) {
				throw new Meteor.Error(401, `Restart token is invalid`)
			}

			setTimeout(() => {
				// eslint-disable-next-line no-process-exit
				process.exit(0)
			}, 3000)
			return `Restarting Core in 3s.`
		})
	}

	async guiFocused(userEvent: string, viewInfo: any[]) {
		return ServerClientAPI.runUserActionInLog(this, userEvent, 'guiFocused', [viewInfo], async () => {
			triggerWriteAccessBecauseNoCheckNecessary()
		})
	}
	async guiBlurred(userEvent: string, viewInfo: any[]) {
		return ServerClientAPI.runUserActionInLog(this, userEvent, 'guiBlurred', [viewInfo], async () => {
			triggerWriteAccessBecauseNoCheckNecessary()
		})
	}

	async bucketsRemoveBucket(userEvent: string, bucketId: BucketId) {
		check(bucketId, String)

		return ServerClientAPI.runUserActionInLog(this, userEvent, 'bucketsRemoveBucket', [bucketId], async () => {
			const access = BucketSecurity.allowWriteAccess(this, bucketId)
			return BucketsAPI.removeBucket(access)
		})
	}
	async bucketsModifyBucket(userEvent: string, bucketId: BucketId, bucketProps: Partial<Omit<Bucket, '_id'>>) {
		check(bucketId, String)
		check(bucketProps, Object)

		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'bucketsModifyBucket',
			[bucketId, bucketProps],
			async () => {
				const access = BucketSecurity.allowWriteAccess(this, bucketId)
				return BucketsAPI.modifyBucket(access, bucketProps)
			}
		)
	}
	async bucketsEmptyBucket(userEvent: string, bucketId: BucketId) {
		check(bucketId, String)

		return ServerClientAPI.runUserActionInLog(this, userEvent, 'bucketsEmptyBucket', [bucketId], async () => {
			const access = BucketSecurity.allowWriteAccess(this, bucketId)
			return BucketsAPI.emptyBucket(access)
		})
	}
	async bucketsCreateNewBucket(userEvent: string, studioId: StudioId, name: string) {
		check(studioId, String)
		check(name, String)

		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'bucketsCreateNewBucket',
			[name, studioId],
			async () => {
				const access = StudioContentWriteAccess.bucket(this, studioId)
				return BucketsAPI.createNewBucket(access, name)
			}
		)
	}
	async bucketsRemoveBucketAdLib(userEvent: string, adlibId: PieceId) {
		check(adlibId, String)

		return ServerClientAPI.runUserActionInLog(this, userEvent, 'bucketsRemoveBucketAdLib', [adlibId], async () => {
			const access = BucketSecurity.allowWriteAccessPiece(this, adlibId)
			return BucketsAPI.removeBucketAdLib(access)
		})
	}
	async bucketsRemoveBucketAdLibAction(userEvent: string, actionId: AdLibActionId) {
		check(actionId, String)

		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'bucketsRemoveBucketAdLibAction',
			[actionId],
			async () => {
				const access = BucketSecurity.allowWriteAccessAction(this, actionId)
				return BucketsAPI.removeBucketAdLibAction(access)
			}
		)
	}
	async bucketsModifyBucketAdLib(userEvent: string, adlibId: PieceId, adlibProps: Partial<Omit<BucketAdLib, '_id'>>) {
		check(adlibId, String)
		check(adlibProps, Object)

		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'bucketsModifyBucketAdLib',
			[adlibId, adlibProps],
			async () => {
				const access = BucketSecurity.allowWriteAccessPiece(this, adlibId)
				return BucketsAPI.modifyBucketAdLib(access, adlibProps)
			}
		)
	}
	async bucketsModifyBucketAdLibAction(
		userEvent: string,
		actionId: AdLibActionId,
		actionProps: Partial<Omit<BucketAdLibAction, '_id'>>
	) {
		check(actionId, String)
		check(actionProps, Object)

		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'bucketsModifyBucketAdLib',
			[actionId, actionProps],
			async () => {
				const access = BucketSecurity.allowWriteAccessAction(this, actionId)
				return BucketsAPI.modifyBucketAdLibAction(access, actionProps)
			}
		)
	}
	async bucketsSaveActionIntoBucket(
		userEvent: string,
		studioId: StudioId,
		bucketId: BucketId,
		action: AdLibActionCommon | BucketAdLibAction
	): Promise<ClientAPI.ClientResponse<BucketAdLibAction>> {
		check(studioId, String)
		check(bucketId, String)
		check(action, Object)

		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'bucketsSaveActionIntoBucket',
			[studioId, bucketId, action],
			async () => {
				const access = BucketSecurity.allowWriteAccess(this, bucketId)
				return BucketsAPI.saveAdLibActionIntoBucket(access, action)
			}
		)
	}
	async switchRouteSet(
		userEvent: string,
		studioId: StudioId,
		routeSetId: string,
		state: boolean
	): Promise<ClientAPI.ClientResponse<void>> {
		check(studioId, String)
		check(routeSetId, String)
		check(state, Boolean)

		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'packageManagerRestartAllExpectations',
			[studioId, routeSetId, state],
			async () => {
				const access = StudioContentWriteAccess.routeSet(this, studioId)
				return ServerPlayoutAPI.switchRouteSet(access, routeSetId, state)
			}
		)
	}
	async moveRundown(
		userEvent: string,
		rundownId: RundownId,
		intoPlaylistId: RundownPlaylistId | null,
		rundownsIdsInPlaylistInOrder: RundownId[]
	): Promise<ClientAPI.ClientResponse<void>> {
		check(rundownId, String)
		check(intoPlaylistId, Match.OneOf(String, null))
		check(rundownsIdsInPlaylistInOrder, Array)

		return ServerClientAPI.runUserActionInLogForRundownOnWorker(
			this,
			userEvent,
			rundownId,
			StudioJobs.OrderMoveRundownToPlaylist,
			{
				rundownId: rundownId,
				intoPlaylistId,
				rundownsIdsInPlaylistInOrder: rundownsIdsInPlaylistInOrder,
			}
		)
	}
	async restoreRundownOrder(
		userEvent: string,
		playlistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>> {
		check(playlistId, String)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			playlistId,
			StudioJobs.OrderRestoreToDefault,
			{
				playlistId: playlistId,
			}
		)
	}
	async disablePeripheralSubDevice(
		userEvent: string,
		peripheralDeviceId: PeripheralDeviceId,
		subDeviceId: string,
		disable: boolean
	): Promise<ClientAPI.ClientResponse<void>> {
		check(peripheralDeviceId, String)
		check(subDeviceId, String)
		check(disable, Boolean)

		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'packageManagerRestartAllExpectations',
			[peripheralDeviceId, subDeviceId, disable],
			async () => {
				const access = PeripheralDeviceContentWriteAccess.peripheralDevice(this, peripheralDeviceId)
				return ServerPeripheralDeviceAPI.disableSubDevice(access, subDeviceId, disable)
			}
		)
	}
}
registerClassToMeteorMethods(UserActionAPIMethods, ServerUserActionAPI, false)
