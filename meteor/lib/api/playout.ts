export namespace PlayoutAPI {
	export enum methods {

		'rundownPrepareForBroadcast' 		= 'playout.rundownPrepareForBroadcast',
		'rundownResetRundown' 				= 'playout.rundownResetRundownt',
		'rundownResetAndActivate' 			= 'playout.rundownResetAndActivate',
		'rundownActivate' 					= 'playout.rundownActivate',
		'rundownDeactivate' 				= 'playout.rundownDeactivate',
		'reloadData' 						= 'playout.reloadData',

		'updateStudioBaseline'				= 'playout.updateStudioBaseline',
		'shouldUpdateStudioBaseline'		= 'playout.shouldUpdateStudioBaseline',

		'rundownTake'						= 'playout.rundownTake',
		'rundownSetNext'					= 'playout.rundownSetNext',
		'rundownMoveNext'					= 'playout.rundownMoveNext',
		'rundownActivateHold'				= 'playout.rundownActivateHold',
		'rundownDisableNextPiece'			= 'playout.rundownDisableNextPiece',
		'rundownTogglePartArgument'			= 'playout.rundownTogglePartArgument',
		// 'partPlaybackStartedCallback'		= 'playout.partPlaybackStartedCallback',
		// 'piecePlaybackStartedCallback'		= 'playout.piecePlaybackStartedCallback',
		'pieceTakeNow'						= 'playout.pieceTakeNow',
		'segmentAdLibPieceStart'			= 'playout.segmentAdLibPieceStart',
		'rundownBaselineAdLibPieceStart'	= 'playout.rundownBaselineAdLibPieceStart',
		'segmentAdLibPieceStop'				= 'playout.segmentAdLibPieceStop',
		'sourceLayerOnPartStop'				= 'playout.sourceLayerOnPartStop',
		'sourceLayerStickyPieceStart'		= 'playout.sourceLayerStickyPieceStart',
		// 'timelineTriggerTimeUpdateCallback'	= 'playout.timelineTriggerTimeUpdateCallback',
	}
}
