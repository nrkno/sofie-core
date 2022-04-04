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
import { registerClassToMeteorMethods, ReplaceOptionalWithNullInMethodArguments } from '../methods'
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
import { ShowStyleBaseId } from '../../lib/collections/ShowStyleBases'

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

class ServerUserActionAPI
	extends MethodContextAPI
	implements ReplaceOptionalWithNullInMethodArguments<NewUserActionAPI>
{
	async take(userEvent: string, rundownPlaylistId: RundownPlaylistId, fromPartInstanceId: PartInstanceId | null) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(fromPartInstanceId, Match.OneOf(String, null))
			},
			StudioJobs.TakeNextPart,
			{
				playlistId: rundownPlaylistId,
				fromPartInstanceId,
			}
		)
	}
	async setNext(
		userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		nextPartId: PartId,
		timeOffset: number | null
	) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(nextPartId, String)
			},
			StudioJobs.SetNextPart,
			{
				playlistId: rundownPlaylistId,
				nextPartId,
				setManually: true,
				nextTimeOffset: timeOffset ?? undefined,
			}
		)
	}
	async setNextSegment(userEvent: string, rundownPlaylistId: RundownPlaylistId, nextSegmentId: SegmentId | null) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(nextSegmentId, Match.OneOf(String, null))
			},
			StudioJobs.SetNextSegment,
			{
				playlistId: rundownPlaylistId,
				nextSegmentId,
			}
		)
	}
	async moveNext(userEvent: string, rundownPlaylistId: RundownPlaylistId, partDelta: number, segmentDelta: number) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(partDelta, Number)
				check(segmentDelta, Number)
			},
			StudioJobs.MoveNextPart,
			{
				playlistId: rundownPlaylistId,
				partDelta: partDelta,
				segmentDelta: segmentDelta,
			}
		)
	}
	async prepareForBroadcast(userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.PrepareRundownForBroadcast,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async resetRundownPlaylist(userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.ResetRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async resetAndActivate(userEvent: string, rundownPlaylistId: RundownPlaylistId, rehearsal: boolean | null) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(rehearsal, Match.Maybe(Boolean))
			},
			StudioJobs.ResetRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
				activate: rehearsal ? 'rehearsal' : 'active',
			}
		)
	}
	async activate(userEvent: string, rundownPlaylistId: RundownPlaylistId, rehearsal: boolean) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(rehearsal, Boolean)
			},
			StudioJobs.ActivateRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
				rehearsal: rehearsal,
			}
		)
	}
	async deactivate(userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.DeactivateRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async forceResetAndActivate(userEvent: string, rundownPlaylistId: RundownPlaylistId, rehearsal: boolean) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(rehearsal, Boolean)
			},
			StudioJobs.ResetRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
				activate: rehearsal ? 'rehearsal' : 'active',
				forceActivate: true,
			}
		)
	}
	async disableNextPiece(userEvent: string, rundownPlaylistId: RundownPlaylistId, undo: boolean | null) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(undo, Match.Maybe(Boolean))
			},
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
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(partInstanceId, String)
				check(pieceInstanceIdOrPieceIdToCopy, String)
			},
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
		return ServerClientAPI.runUserActionInLogForPlaylist(
			this,
			userEvent,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(partId, String)
				check(pieceId, String)
				check(inPoint, Number)
				check(duration, Number)
			},
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
		triggerMode: string | null
	) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(actionDocId, String)
				check(actionId, String)
				check(userData, Match.Any)
				check(triggerMode, Match.Maybe(String))
			},
			StudioJobs.ExecuteAction,
			{
				playlistId: rundownPlaylistId,
				actionDocId,
				actionId,
				userData,
				triggerMode: triggerMode || undefined,
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
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(partInstanceId, String)
				check(adlibPieceId, String)
				check(queue, Boolean)
			},
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
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(partInstanceId, String)
				check(sourceLayerIds, [String])
			},
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
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(partInstanceId, String)
				check(adlibPieceId, String)
				check(queue, Boolean)
			},
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
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(sourceLayerId, String)
			},
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
		showStyleBaseId: ShowStyleBaseId,
		ingestItem: IngestAdlib
	) {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'bucketAdlibImport',
			[bucketId, showStyleBaseId, ingestItem],
			async () => {
				check(bucketId, String)
				check(showStyleBaseId, String)
				check(ingestItem, Object)

				const access = BucketSecurity.allowWriteAccess(this, bucketId)
				return BucketsAPI.importAdlibToBucket(access, showStyleBaseId, undefined, ingestItem)
			}
		)
	}
	async bucketAdlibStart(
		userEvent: string,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		bucketAdlibId: PieceId,
		queue: boolean | null
	) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(partInstanceId, String)
				check(bucketAdlibId, String)
				check(queue, Match.Maybe(Boolean))
			},
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
	async activateHold(userEvent: string, rundownPlaylistId: RundownPlaylistId, undo: boolean | null) {
		if (undo) {
			return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
				this,
				userEvent,
				rundownPlaylistId,
				() => {
					check(rundownPlaylistId, String)
				},
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
				() => {
					check(rundownPlaylistId, String)
				},
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
			() => {
				//
			},
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
			() => {
				check(playlistId, String)
				check(reason, String)
			},
			'storeRundownSnapshot',
			[playlistId, reason],
			async (access) => {
				return storeRundownPlaylistSnapshot(access, playlistId, reason)
			}
		)
	}
	async removeRundownPlaylist(userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.RemovePlaylist,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async resyncRundownPlaylist(userEvent: string, playlistId: RundownPlaylistId) {
		return ServerClientAPI.runUserActionInLogForPlaylist(
			this,
			userEvent,
			playlistId,
			() => {
				check(playlistId, String)
			},
			'resyncRundownPlaylist',
			[playlistId],
			async (access) => {
				return ServerRundownAPI.resyncRundownPlaylist(access)
			}
		)
	}
	async unsyncRundown(userEvent: string, rundownId: RundownId) {
		return ServerClientAPI.runUserActionInLogForRundown(
			this,
			userEvent,
			rundownId,
			() => {
				check(rundownId, String)
			},
			'unsyncRundown',
			[rundownId],
			async (access) => {
				return ServerRundownAPI.unsyncRundown(access)
			}
		)
	}
	async removeRundown(userEvent: string, rundownId: RundownId) {
		return ServerClientAPI.runUserActionInLogForRundown(
			this,
			userEvent,
			rundownId,
			() => {
				check(rundownId, String)
			},
			'removeRundown',
			[rundownId],
			async (access) => {
				return ServerRundownAPI.removeRundown(access)
			}
		)
	}
	async resyncRundown(userEvent: string, rundownId: RundownId) {
		return ServerClientAPI.runUserActionInLogForRundown(
			this,
			userEvent,
			rundownId,
			() => {
				check(rundownId, String)
			},
			'resyncRundown',
			[rundownId],
			async (access) => {
				return ServerRundownAPI.innerResyncRundown(access.rundown)
			}
		)
	}
	async mediaRestartWorkflow(userEvent: string, workflowId: MediaWorkFlowId) {
		return ServerClientAPI.runUserActionInLog(this, userEvent, 'mediaRestartWorkflow', [workflowId], async () => {
			check(workflowId, String)

			const access = PeripheralDeviceContentWriteAccess.mediaWorkFlow(this, workflowId)
			return MediaManagerAPI.restartWorkflow(access)
		})
	}
	async mediaAbortWorkflow(userEvent: string, workflowId: MediaWorkFlowId) {
		return ServerClientAPI.runUserActionInLog(this, userEvent, 'mediaAbortWorkflow', [workflowId], async () => {
			check(workflowId, String)

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
				check(workflowId, String)

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
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'packageManagerRestartExpectation',
			[deviceId, workId],
			async () => {
				check(deviceId, String)
				check(workId, String)

				const access = PeripheralDeviceContentWriteAccess.peripheralDevice(this, deviceId)
				return PackageManagerAPI.restartExpectation(access, workId)
			}
		)
	}
	async packageManagerRestartAllExpectations(userEvent: string, studioId: StudioId) {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'packageManagerRestartAllExpectations',
			[studioId],
			async () => {
				check(studioId, String)

				const access = StudioContentWriteAccess.anyContent(this, studioId)
				return PackageManagerAPI.restartAllExpectationsInStudio(access)
			}
		)
	}
	async packageManagerAbortExpectation(userEvent: string, deviceId: PeripheralDeviceId, workId: string) {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'packageManagerAbortExpectation',
			[deviceId, workId],
			async () => {
				check(deviceId, String)
				check(workId, String)

				const access = PeripheralDeviceContentWriteAccess.peripheralDevice(this, deviceId)
				return PackageManagerAPI.abortExpectation(access, workId)
			}
		)
	}
	async packageManagerRestartPackageContainer(userEvent: string, deviceId: PeripheralDeviceId, containerId: string) {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'packageManagerRestartPackageContainer',
			[deviceId, containerId],
			async () => {
				check(deviceId, String)
				check(containerId, String)

				const access = PeripheralDeviceContentWriteAccess.peripheralDevice(this, deviceId)
				return PackageManagerAPI.restartPackageContainer(access, containerId)
			}
		)
	}
	async regenerateRundownPlaylist(userEvent: string, rundownPlaylistId: RundownPlaylistId) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
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
		return ServerClientAPI.runUserActionInLog(this, userEvent, 'restartCore', [hashedRestartToken], async () => {
			check(hashedRestartToken, String)

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

	async guiFocused(userEvent: string, viewInfo: any[] | null) {
		return ServerClientAPI.runUserActionInLog(this, userEvent, 'guiFocused', [viewInfo], async () => {
			triggerWriteAccessBecauseNoCheckNecessary()
		})
	}
	async guiBlurred(userEvent: string, viewInfo: any[] | null) {
		return ServerClientAPI.runUserActionInLog(this, userEvent, 'guiBlurred', [viewInfo], async () => {
			triggerWriteAccessBecauseNoCheckNecessary()
		})
	}

	async bucketsRemoveBucket(userEvent: string, bucketId: BucketId) {
		return ServerClientAPI.runUserActionInLog(this, userEvent, 'bucketsRemoveBucket', [bucketId], async () => {
			check(bucketId, String)

			const access = BucketSecurity.allowWriteAccess(this, bucketId)
			return BucketsAPI.removeBucket(access)
		})
	}
	async bucketsModifyBucket(userEvent: string, bucketId: BucketId, bucketProps: Partial<Omit<Bucket, '_id'>>) {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'bucketsModifyBucket',
			[bucketId, bucketProps],
			async () => {
				check(bucketId, String)
				check(bucketProps, Object)

				const access = BucketSecurity.allowWriteAccess(this, bucketId)
				return BucketsAPI.modifyBucket(access, bucketProps)
			}
		)
	}
	async bucketsEmptyBucket(userEvent: string, bucketId: BucketId) {
		return ServerClientAPI.runUserActionInLog(this, userEvent, 'bucketsEmptyBucket', [bucketId], async () => {
			check(bucketId, String)

			const access = BucketSecurity.allowWriteAccess(this, bucketId)
			return BucketsAPI.emptyBucket(access)
		})
	}
	async bucketsCreateNewBucket(userEvent: string, studioId: StudioId, name: string) {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'bucketsCreateNewBucket',
			[name, studioId],
			async () => {
				check(studioId, String)
				check(name, String)

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
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'bucketsRemoveBucketAdLibAction',
			[actionId],
			async () => {
				check(actionId, String)

				const access = BucketSecurity.allowWriteAccessAction(this, actionId)
				return BucketsAPI.removeBucketAdLibAction(access)
			}
		)
	}
	async bucketsModifyBucketAdLib(userEvent: string, adlibId: PieceId, adlibProps: Partial<Omit<BucketAdLib, '_id'>>) {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'bucketsModifyBucketAdLib',
			[adlibId, adlibProps],
			async () => {
				check(adlibId, String)
				check(adlibProps, Object)

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
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'bucketsModifyBucketAdLib',
			[actionId, actionProps],
			async () => {
				check(actionId, String)
				check(actionProps, Object)

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
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'bucketsSaveActionIntoBucket',
			[studioId, bucketId, action],
			async () => {
				check(studioId, String)
				check(bucketId, String)
				check(action, Object)

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
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'packageManagerRestartAllExpectations',
			[studioId, routeSetId, state],
			async () => {
				check(studioId, String)
				check(routeSetId, String)
				check(state, Boolean)

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
		return ServerClientAPI.runUserActionInLogForRundownOnWorker(
			this,
			userEvent,
			rundownId,
			() => {
				check(rundownId, String)
				check(intoPlaylistId, Match.OneOf(String, null))
				check(rundownsIdsInPlaylistInOrder, Array)
			},
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
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			playlistId,
			() => {
				check(playlistId, String)
			},
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
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			'packageManagerRestartAllExpectations',
			[peripheralDeviceId, subDeviceId, disable],
			async () => {
				check(peripheralDeviceId, String)
				check(subDeviceId, String)
				check(disable, Boolean)

				const access = PeripheralDeviceContentWriteAccess.peripheralDevice(this, peripheralDeviceId)
				return ServerPeripheralDeviceAPI.disableSubDevice(access, subDeviceId, disable)
			}
		)
	}
}
registerClassToMeteorMethods(UserActionAPIMethods, ServerUserActionAPI, false)
