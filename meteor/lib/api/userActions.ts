import { ClientAPI } from '../api/client'
import { MethodsBase, MeteorCall } from './methods'
import { RundownPlaylistId } from '../collections/RundownPlaylists'
import { PartId } from '../collections/Parts'
import { RundownId } from '../collections/Rundowns'
import { PartInstanceId } from '../collections/PartInstances'
import { PieceInstanceId } from '../collections/PieceInstances'
import { PieceId } from '../collections/Pieces'
import { EvaluationBase } from '../collections/Evaluations'
import { StudioId } from '../collections/Studios'
import { RecordedFileId } from '../collections/RecordedFiles'
import { MediaWorkFlowId } from '../collections/MediaWorkFlows'
import { SnapshotId } from '../collections/Snapshots'

export interface NewUserActionAPI {
	take (rundownPlaylistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<void>>
	setNext (rundownPlaylistId: RundownPlaylistId, partId: PartId, timeOffset?: number): Promise<ClientAPI.ClientResponse<void>>
	moveNext (rundownPlaylistId: RundownPlaylistId, horisontalDelta: number, verticalDelta: number): Promise<ClientAPI.ClientResponse<PartId | null>>
	prepareForBroadcast (rundownPlaylistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<void>>
	resetRundownPlaylist (rundownPlaylistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<void>>
	resetAndActivate (rundownPlaylistId: RundownPlaylistId, rehearsal?: boolean): Promise<ClientAPI.ClientResponse<void>>
	activate (rundownPlaylistId: RundownPlaylistId, rehearsal: boolean): Promise<ClientAPI.ClientResponse<void>>
	deactivate (rundownPlaylistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<void>>
	forceResetAndActivate (rundownPlaylistId: RundownPlaylistId, rehearsal: boolean): Promise<ClientAPI.ClientResponse<void>>
	reloadData (rundownPlaylistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<ReloadRundownPlaylistResponse>>
	unsyncRundown (rundownId: RundownId): Promise<ClientAPI.ClientResponse<void>>
	disableNextPiece (rundownPlaylistId: RundownPlaylistId, undo?: boolean): Promise<ClientAPI.ClientResponse<void>>
	togglePartArgument (rundownPlaylistId: RundownPlaylistId, partInstanceId: PartInstanceId, property: string, value: string): Promise<ClientAPI.ClientResponse<void>>
	pieceTakeNow (rundownPlaylistId: RundownPlaylistId, partInstanceId: PartInstanceId, pieceInstanceIdOrPieceIdToCopy: PieceInstanceId | PieceId): Promise<ClientAPI.ClientResponse<void>>
	setInOutPoints (rundownPlaylistId: RundownPlaylistId, partId: PartId, pieceId: PieceId, inPoint: number, duration: number): Promise<ClientAPI.ClientResponse<void>>
	segmentAdLibPieceStart (rundownPlaylistId: RundownPlaylistId, partInstanceId: PartInstanceId, adLibPieceId: PieceId, queue: boolean)
	sourceLayerOnPartStop (rundownPlaylistId: RundownPlaylistId, partInstanceId: PartInstanceId, sourceLayerId: string)
	baselineAdLibPieceStart (rundownPlaylistId: RundownPlaylistId, partInstanceId: PartInstanceId, adlibPieceId: PieceId, queue: boolean)
	sourceLayerStickyPieceStart (rundownPlaylistId: RundownPlaylistId, sourceLayerId: string): Promise<ClientAPI.ClientResponse<void>>
	activateHold (rundownPlaylistId: RundownPlaylistId, undo?: boolean): Promise<ClientAPI.ClientResponse<void>>
	saveEvaluation (evaluation: EvaluationBase): Promise<ClientAPI.ClientResponse<void>>
	storeRundownSnapshot (playlistId: RundownPlaylistId, reason: string): Promise<ClientAPI.ClientResponse<SnapshotId>>
	removeRundownPlaylist (playlistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<void>>
	resyncRundownPlaylist (playlistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<ReloadRundownPlaylistResponse>>
	removeRundown (rundownId: RundownId): Promise<ClientAPI.ClientResponse<void>>
	resyncRundown (rundownId: RundownId): Promise<ClientAPI.ClientResponse<ReloadRundownResponse>>
	recordStop (studioId: StudioId): Promise<ClientAPI.ClientResponse<boolean>>
	recordStart (studioId: StudioId, name: string): Promise<ClientAPI.ClientResponse<boolean>>
	recordDelete (id: RecordedFileId): Promise<ClientAPI.ClientResponse<void>>
	mediaRestartWorkflow (workflowId: MediaWorkFlowId): Promise<ClientAPI.ClientResponse<void>>
	mediaAbortWorkflow (workflowId: MediaWorkFlowId): Promise<ClientAPI.ClientResponse<void>>
	mediaPrioritizeWorkflow (workflowId: MediaWorkFlowId): Promise<ClientAPI.ClientResponse<void>>
	mediaRestartAllWorkflows (): Promise<ClientAPI.ClientResponse<void>>
	mediaAbortAllWorkflows (): Promise<ClientAPI.ClientResponse<void>>
	regenerateRundownPlaylist (playlistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<void>>
	generateRestartToken (): Promise<ClientAPI.ClientResponse<string>>
	restartCore (token: string): Promise<ClientAPI.ClientResponse<string>>
	guiFocused (): Promise<ClientAPI.ClientResponse<void>>
	guiBlurred (): Promise<ClientAPI.ClientResponse<void>>
}

export enum UserActionAPIMethods {
	'take' 									= 'userAction.take',
	'setNext' 								= 'userAction.setNext',
	'moveNext' 								= 'userAction.moveNext',

	'prepareForBroadcast' 					= 'userAction.prepareForBroadcast',
	'resetRundownPlaylist' 					= 'userAction.resetRundownPlaylist',
	'resetAndActivate' 						= 'userAction.resetAndActivate',
	'forceResetAndActivate' 				= 'userAction.forceResetAndActivate',
	'activate' 								= 'userAction.activate',
	'deactivate' 							= 'userAction.deactivate',
	'reloadData' 							= 'userAction.reloadData',
	'unsyncRundown' 						= 'userAction.unsyncRundown',

	'disableNextPiece'						= 'userAction.disableNextPiece',
	'togglePartArgument'					= 'userAction.togglePartArgument',
	'pieceTakeNow'							= 'userAction.pieceTakeNow',
	'setInOutPoints'						= 'userAction.pieceSetInOutPoints',

	'segmentAdLibPieceStart'				= 'userAction.segmentAdLibPieceStart',
	'sourceLayerOnPartStop'					= 'userAction.sourceLayerOnPartStop',
	'baselineAdLibPieceStart'				= 'userAction.baselineAdLibPieceStart',

	'sourceLayerStickyPieceStart'			= 'userAction.sourceLayerStickyPieceStart',

	'activateHold'							= 'userAction.activateHold',

	'saveEvaluation' 						= 'userAction.saveEvaluation',

	'storeRundownSnapshot'					= 'userAction.storeRundownSnapshot',

	'removeRundownPlaylist'					= 'userAction.removeRundownPlaylist',
	'resyncRundownPlaylist'					= 'userAction.resyncRundownPlaylist',

	'removeRundown'							= 'userAction.removeRundown',
	'resyncRundown'							= 'userAction.resyncRundown',

	'recordStop'							= 'userAction.recordStop',
	'recordStart'							= 'userAction.recordStart',
	'recordDelete'							= 'userAction.recordDelete',

	'mediaRestartWorkflow'					= 'userAction.mediamanager.restartWorkflow',
	'mediaAbortWorkflow'					= 'userAction.mediamanager.abortWorkflow',
	'mediaRestartAllWorkflows'				= 'userAction.mediamanager.restartAllWorkflows',
	'mediaAbortAllWorkflows'				= 'userAction.mediamanager.abortAllWorkflows',
	'mediaPrioritizeWorkflow'				= 'userAction.mediamanager.mediaPrioritizeWorkflow',

	'regenerateRundownPlaylist'				= 'userAction.ingest.regenerateRundownPlaylist',

	'generateRestartToken'					= 'userAction.system.generateRestartToken',
	'restartCore'							= 'userAction.system.restartCore',

	'guiFocused'							= 'userAction.focused',
	'guiBlurred'							= 'userAction.blurred'
}
export function CallUserActionAPIMethod (method: UserActionAPIMethods, ...args: any[]) {
	const m: string = method
	const fcn = MeteorCall[m.replace(/^userAction\./,'')]
	return fcn(...args)
}

export interface ReloadRundownPlaylistResponse {
	rundownsResponses: {
		rundownId: RundownId
		response: ReloadRundownResponse
	}[]
}

export enum ReloadRundownResponse {
	/** When reloading has been successfully completed */
	COMPLETED = 'ok',
	/** When reloading has successfully started, and will finish asynchronously */
	WORKING = 'working',
	/** When reloading cannot continue, because the rundown is missing */
	MISSING = 'missing'
}

export const RESTART_SALT = 'clientRestart_'
