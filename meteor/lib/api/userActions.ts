import { ClientAPI } from '../api/client'
import { MeteorCall } from './methods'
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
import { SegmentId } from '../collections/Segments'
import { AdLibActionId } from '../collections/AdLibActions'
import { ActionUserData } from 'tv-automation-sofie-blueprints-integration'

export interface NewUserActionAPI {
	take						(userEvent: string, rundownPlaylistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<void>>
	setNext						(userEvent: string, rundownPlaylistId: RundownPlaylistId, partId: PartId, timeOffset?: number): Promise<ClientAPI.ClientResponse<void>>
	setNextSegment				(userEvent: string, rundownPlaylistId: RundownPlaylistId, segmentId: SegmentId | null): Promise<ClientAPI.ClientResponse<void>>
	moveNext					(userEvent: string, rundownPlaylistId: RundownPlaylistId, horisontalDelta: number, verticalDelta: number): Promise<ClientAPI.ClientResponse<PartId | null>>
	prepareForBroadcast			(userEvent: string, rundownPlaylistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<void>>
	resetRundownPlaylist		(userEvent: string, rundownPlaylistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<void>>
	resetAndActivate			(userEvent: string, rundownPlaylistId: RundownPlaylistId, rehearsal?: boolean): Promise<ClientAPI.ClientResponse<void>>
	activate					(userEvent: string, rundownPlaylistId: RundownPlaylistId, rehearsal: boolean): Promise<ClientAPI.ClientResponse<void>>
	deactivate					(userEvent: string, rundownPlaylistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<void>>
	forceResetAndActivate		(userEvent: string, rundownPlaylistId: RundownPlaylistId, rehearsal: boolean): Promise<ClientAPI.ClientResponse<void>>
	reloadData					(userEvent: string, rundownPlaylistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<ReloadRundownPlaylistResponse>>
	unsyncRundown				(userEvent: string, rundownId: RundownId): Promise<ClientAPI.ClientResponse<void>>
	disableNextPiece			(userEvent: string, rundownPlaylistId: RundownPlaylistId, undo?: boolean): Promise<ClientAPI.ClientResponse<void>>
	togglePartArgument			(userEvent: string, rundownPlaylistId: RundownPlaylistId, partInstanceId: PartInstanceId, property: string, value: string): Promise<ClientAPI.ClientResponse<void>>
	pieceTakeNow				(userEvent: string, rundownPlaylistId: RundownPlaylistId, partInstanceId: PartInstanceId, pieceInstanceIdOrPieceIdToCopy: PieceInstanceId | PieceId): Promise<ClientAPI.ClientResponse<void>>
	setInOutPoints				(userEvent: string, rundownPlaylistId: RundownPlaylistId, partId: PartId, pieceId: PieceId, inPoint: number, duration: number): Promise<ClientAPI.ClientResponse<void>>
	executeAction				(userEvent: string, rundownPlaylistId: RundownPlaylistId, actionId: string, userData: ActionUserData): Promise<ClientAPI.ClientResponse<void>>
	segmentAdLibPieceStart		(userEvent: string, rundownPlaylistId: RundownPlaylistId, partInstanceId: PartInstanceId, adLibPieceId: PieceId, queue: boolean)
	sourceLayerOnPartStop		(userEvent: string, rundownPlaylistId: RundownPlaylistId, partInstanceId: PartInstanceId, sourceLayerIds: string[])
	baselineAdLibPieceStart		(userEvent: string, rundownPlaylistId: RundownPlaylistId, partInstanceId: PartInstanceId, adlibPieceId: PieceId, queue: boolean)
	sourceLayerStickyPieceStart	(userEvent: string, rundownPlaylistId: RundownPlaylistId, sourceLayerId: string): Promise<ClientAPI.ClientResponse<void>>
	activateHold				(userEvent: string, rundownPlaylistId: RundownPlaylistId, undo?: boolean): Promise<ClientAPI.ClientResponse<void>>
	saveEvaluation				(userEvent: string, evaluation: EvaluationBase): Promise<ClientAPI.ClientResponse<void>>
	storeRundownSnapshot		(userEvent: string, playlistId: RundownPlaylistId, reason: string): Promise<ClientAPI.ClientResponse<SnapshotId>>
	removeRundownPlaylist		(userEvent: string, playlistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<void>>
	resyncRundownPlaylist		(userEvent: string, playlistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<ReloadRundownPlaylistResponse>>
	removeRundown				(userEvent: string, rundownId: RundownId): Promise<ClientAPI.ClientResponse<void>>
	resyncRundown				(userEvent: string, rundownId: RundownId): Promise<ClientAPI.ClientResponse<ReloadRundownResponse>>
	recordStop					(userEvent: string, studioId: StudioId): Promise<ClientAPI.ClientResponse<void>>
	recordStart					(userEvent: string, studioId: StudioId, name: string): Promise<ClientAPI.ClientResponse<void>>
	recordDelete				(userEvent: string, id: RecordedFileId): Promise<ClientAPI.ClientResponse<void>>
	mediaRestartWorkflow		(userEvent: string, workflowId: MediaWorkFlowId): Promise<ClientAPI.ClientResponse<void>>
	mediaAbortWorkflow			(userEvent: string, workflowId: MediaWorkFlowId): Promise<ClientAPI.ClientResponse<void>>
	mediaPrioritizeWorkflow		(userEvent: string, workflowId: MediaWorkFlowId): Promise<ClientAPI.ClientResponse<void>>
	mediaRestartAllWorkflows	(userEvent: string): Promise<ClientAPI.ClientResponse<void>>
	mediaAbortAllWorkflows		(userEvent: string): Promise<ClientAPI.ClientResponse<void>>
	regenerateRundownPlaylist	(userEvent: string, playlistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<void>>
	generateRestartToken		(userEvent: string): Promise<ClientAPI.ClientResponse<string>>
	restartCore					(userEvent: string, token: string): Promise<ClientAPI.ClientResponse<string>>
	guiFocused					(userEvent: string, viewInfo?: any[]): Promise<ClientAPI.ClientResponse<void>>
	guiBlurred					(userEvent: string, viewInfo?: any[]): Promise<ClientAPI.ClientResponse<void>>
}

export enum UserActionAPIMethods {
	'take' 									= 'userAction.take',
	'setNext' 								= 'userAction.setNext',
	'setNextSegment' 						= 'userAction.setNextSegment',
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
	'executeAction'							= 'userAction.executeAction',

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
