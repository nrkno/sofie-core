import { MethodsBase } from './methods'
import { RundownPlaylistId } from '../collections/RundownPlaylists'
import { PartInstanceId } from '../collections/PartInstances'
import { PieceInstanceId } from '../collections/PieceInstances'
import { PieceId } from '../collections/Pieces'
import { PartId } from '../collections/Parts'
import { StudioId } from '../collections/Studios'

export interface NewPlayoutAPI {
	rundownPrepareForBroadcast (playlistId: RundownPlaylistId): Promise<any>
	rundownResetRundown (playlistId: RundownPlaylistId): Promise<any>
	rundownResetAndActivate (playlistId: RundownPlaylistId, rehearsal?: boolean): Promise<any>
	rundownActivate (playlistId: RundownPlaylistId, rehearsal: boolean): Promise<any>
	rundownDeactivate (playlistId: RundownPlaylistId): Promise<any>
	reloadRundownPlaylistData (playlistId: RundownPlaylistId): Promise<any>
	pieceTakeNow (playlistId: RundownPlaylistId, partInstanceId: PartInstanceId, pieceInstanceIdOrPieceIdToCopy: PieceInstanceId | PieceId): Promise<any>
	rundownTake (playlistId: RundownPlaylistId): Promise<any>
	rundownTogglePartArgument (playlistId: RundownPlaylistId, partInstanceId: PartInstanceId, property: string, value: string): Promise<any>
	rundownSetNext (playlistId: RundownPlaylistId, partId: PartId, timeOffset?: number | undefined): Promise<any>
	rundownMoveNext (playlistId: RundownPlaylistId, horisontalDelta: number, verticalDelta: number): Promise<any>
	rundownActivateHold (playlistId: RundownPlaylistId): Promise<any>
	rundownDisableNextPiece (rundownPlaylistId: RundownPlaylistId, undo?: boolean): Promise<any>
	segmentAdLibPieceStart (rundownPlaylistId: RundownPlaylistId, partInstanceId: PartInstanceId, pieceId: PieceId, queue: boolean): Promise<any>
	rundownBaselineAdLibPieceStart (rundownPlaylistId: RundownPlaylistId, partInstanceId: PartInstanceId, pieceId: PieceId, queue: boolean): Promise<any>
	sourceLayerOnPartStop (rundownPlaylistId: RundownPlaylistId, partInstanceId: PartInstanceId, sourceLayerId: string): Promise<any>
	sourceLayerStickyPieceStart (playlistId: RundownPlaylistId, sourceLayerId: string): Promise<any>
	updateStudioBaseline (studioId: StudioId): Promise<any>
	shouldUpdateStudioBaseline (studioId: StudioId): Promise<any>
}

export enum PlayoutAPIMethods {

	'rundownPrepareForBroadcast' 		= 'playout.rundownPrepareForBroadcast',
	'rundownResetRundown' 				= 'playout.rundownResetRundownt',
	'rundownResetAndActivate' 			= 'playout.rundownResetAndActivate',
	'rundownActivate' 					= 'playout.rundownActivate',
	'rundownDeactivate' 				= 'playout.rundownDeactivate',
	'reloadRundownPlaylistData' 		= 'playout.reloadRundownPlaylistData',

	'updateStudioBaseline'				= 'playout.updateStudioBaseline',
	'shouldUpdateStudioBaseline'		= 'playout.shouldUpdateStudioBaseline',

	'rundownTake'						= 'playout.rundownTake',
	'rundownSetNext'					= 'playout.rundownSetNext',
	'rundownMoveNext'					= 'playout.rundownMoveNext',
	'rundownActivateHold'				= 'playout.rundownActivateHold',
	'rundownDisableNextPiece'			= 'playout.rundownDisableNextPiece',
	'rundownTogglePartArgument'			= 'playout.rundownTogglePartArgument',

	'pieceTakeNow'						= 'playout.pieceTakeNow',
	'segmentAdLibPieceStart'			= 'playout.segmentAdLibPieceStart',
	'rundownBaselineAdLibPieceStart'	= 'playout.rundownBaselineAdLibPieceStart',
	'sourceLayerOnPartStop'				= 'playout.sourceLayerOnPartStop',
	'sourceLayerStickyPieceStart'		= 'playout.sourceLayerStickyPieceStart',
}
