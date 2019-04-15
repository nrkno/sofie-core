export namespace PlayoutAPI {
	export enum methods {

		'rundownPrepareForBroadcast' = 'playout.rundownPrepareForBroadcast',
		'rundownResetRundown' 	= 'playout.rundownResetRundownt',
		'rundownResetAndActivate' 	= 'playout.rundownResetAndActivate',
		'rundownActivate' 			= 'playout.rundownActivate',
		'rundownDeactivate' 			= 'playout.rundownDeactivate',
		'reloadData' 			= 'playout.reloadData',

		'updateStudioBaseline'			= 'playout.updateStudioBaseline',
		'shouldUpdateStudioBaseline'	= 'playout.shouldUpdateStudioBaseline',

		'rundownTake' = 'playout.rundownTake',
		'rundownSetNext' = 'playout.rundownSetNext',
		'rundownMoveNext' = 'playout.rundownMoveNext',
		'rundownActivateHold' = 'playout.rundownActivateHold',
		'rundownStoriesMoved' = 'playout.rundownStoriesMoved',
		'rundownDisableNextPiece' = 'playout.rundownDisableNextPiece',
		'rundownTogglePartArgument' = 'playout.rundownTogglePartArgument',
		'partPlaybackStartedCallback' = 'playout.partPlaybackStartedCallback',
		'piecePlaybackStartedCallback' = 'playout.piecePlaybackStartedCallback',
		'pieceTakeNow' = 'playout.pieceTakeNow',
		'segmentAdLibLineItemStart' = 'playout.segmentAdLibLineItemStart',
		'rundownBaselineAdLibPiecestart' = 'playout.rundownBaselineAdLibPiecestart',
		'segmentAdLibLineItemStop' = 'playout.segmentAdLibLineItemStop',
		'sourceLayerOnLineStop' = 'playout.sourceLayerOnLineStop',
		'sourceLayerStickyItemStart' = 'playout.sourceLayerStickyItemStart',
		'timelineTriggerTimeUpdateCallback' = 'playout.timelineTriggerTimeUpdateCallback',
	}
}
