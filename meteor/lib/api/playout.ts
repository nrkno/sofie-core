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
		'rundownDisableNextSegmentLineItem' = 'playout.rundownDisableNextSegmentLineItem',
		'rundownToggleSegmentLineArgument' = 'playout.rundownToggleSegmentLineArgument',
		'segmentLinePlaybackStartedCallback' = 'playout.segmentLinePlaybackStartedCallback',
		'segmentLineItemPlaybackStartedCallback' = 'playout.segmentLineItemPlaybackStartedCallback',
		'segmentLineItemTakeNow' = 'playout.segmentLineItemTakeNow',
		'segmentAdLibLineItemStart' = 'playout.segmentAdLibLineItemStart',
		'rundownBaselineAdLibItemStart' = 'playout.rundownBaselineAdLibItemStart',
		'segmentAdLibLineItemStop' = 'playout.segmentAdLibLineItemStop',
		'sourceLayerOnLineStop' = 'playout.sourceLayerOnLineStop',
		'sourceLayerStickyItemStart' = 'playout.sourceLayerStickyItemStart',
		'timelineTriggerTimeUpdateCallback' = 'playout.timelineTriggerTimeUpdateCallback',
	}
}
