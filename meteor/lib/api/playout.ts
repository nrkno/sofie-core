import { RundownPlaylistId } from '../collections/RundownPlaylists'
import { PartInstanceId } from '../collections/PartInstances'
import { PieceInstanceId } from '../collections/PieceInstances'
import { PieceId } from '../collections/Pieces'
import { PartId } from '../collections/Parts'
import { StudioId } from '../collections/Studios'
import { ClientAPI } from './client'
import { ReloadRundownPlaylistResponse } from './userActions'
import { SegmentId } from '../collections/Segments'

export interface NewPlayoutAPI {
	rundownPrepareForBroadcast(playlistId: RundownPlaylistId): Promise<void>
	rundownResetRundown(playlistId: RundownPlaylistId): Promise<void>
	rundownResetAndActivate(playlistId: RundownPlaylistId, rehearsal?: boolean): Promise<void>
	rundownActivate(playlistId: RundownPlaylistId, rehearsal: boolean): Promise<void>
	rundownDeactivate(playlistId: RundownPlaylistId): Promise<void>
	reloadRundownPlaylistData(playlistId: RundownPlaylistId): Promise<ReloadRundownPlaylistResponse>
	pieceTakeNow(
		playlistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		pieceInstanceIdOrPieceIdToCopy: PieceInstanceId | PieceId
	): Promise<void>
	rundownTake(playlistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<void>>
	rundownSetNext(
		playlistId: RundownPlaylistId,
		partId: PartId,
		timeOffset?: number | undefined
	): Promise<ClientAPI.ClientResponse<void>>
	rundownSetNextSegment(
		playlistId: RundownPlaylistId,
		segmentId: SegmentId | null
	): Promise<ClientAPI.ClientResponse<void>>
	rundownMoveNext(
		playlistId: RundownPlaylistId,
		horisontalDelta: number,
		verticalDelta: number
	): Promise<PartId | null>
	rundownActivateHold(playlistId: RundownPlaylistId): Promise<void>
	rundownDisableNextPiece(rundownPlaylistId: RundownPlaylistId, undo?: boolean): Promise<void>
	segmentAdLibPieceStart(
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		pieceId: PieceId,
		queue: boolean
	): Promise<void>
	rundownBaselineAdLibPieceStart(
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		pieceId: PieceId,
		queue: boolean
	): Promise<void>
	sourceLayerOnPartStop(
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		sourceLayerIds: string[]
	): Promise<void>
	sourceLayerStickyPieceStart(playlistId: RundownPlaylistId, sourceLayerId: string): Promise<void>
	updateStudioBaseline(studioId: StudioId): Promise<string | false>
	shouldUpdateStudioBaseline(studioId: StudioId): Promise<string | false>
	switchRouteSet(studioId: StudioId, routeSetId: string, state: boolean): Promise<ClientAPI.ClientResponse<void>>
}

export enum PlayoutAPIMethods {
	'rundownPrepareForBroadcast' = 'playout.rundownPrepareForBroadcast',
	'rundownResetRundown' = 'playout.rundownResetRundownt',
	'rundownResetAndActivate' = 'playout.rundownResetAndActivate',
	'rundownActivate' = 'playout.rundownActivate',
	'rundownDeactivate' = 'playout.rundownDeactivate',
	'reloadRundownPlaylistData' = 'playout.reloadRundownPlaylistData',

	'updateStudioBaseline' = 'playout.updateStudioBaseline',
	'shouldUpdateStudioBaseline' = 'playout.shouldUpdateStudioBaseline',

	'rundownTake' = 'playout.rundownTake',
	'rundownSetNext' = 'playout.rundownSetNext',
	'rundownSetNextSegment' = 'playout.rundownSetNextSegment',
	'rundownMoveNext' = 'playout.rundownMoveNext',
	'rundownActivateHold' = 'playout.rundownActivateHold',
	'rundownDisableNextPiece' = 'playout.rundownDisableNextPiece',

	'pieceTakeNow' = 'playout.pieceTakeNow',
	'segmentAdLibPieceStart' = 'playout.segmentAdLibPieceStart',
	'rundownBaselineAdLibPieceStart' = 'playout.rundownBaselineAdLibPieceStart',
	'sourceLayerOnPartStop' = 'playout.sourceLayerOnPartStop',
	'sourceLayerStickyPieceStart' = 'playout.sourceLayerStickyPieceStart',

	'switchRouteSet' = 'playout.switchRouteSet',
}
