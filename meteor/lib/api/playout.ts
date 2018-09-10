export enum PlayoutTimelinePrefixes {
	SEGMENT_LINE_GROUP_PREFIX = 'sl_group_',
	SEGMENT_LINE_GROUP_FIRST_ITEM_PREFIX = 'sl_group_firstobject_',
	SEGMENT_LINE_ITEM_GROUP_PREFIX = 'sli_group_',
	SEGMENT_LINE_ITEM_GROUP_FIRST_ITEM_PREFIX = 'sli_group_firstobject_',
}

export namespace PlayoutAPI {
	export enum methods {
		'reloadData' = 'playout.reloadData',
		'roReset' = 'playout.roReset',
		'roActivate' = 'playout.roActivate',
		/**
		 * Inactivates the RunningOrder
		 * TODO: Clear the Timeline (?)
		 */
		'roDeactivate' = 'playout.roDeactivate',
		/**
		 * Perform the TAKE action, i.e start playing a segmentLineItem
		 */
		'roTake' = 'playout.roTake',
		'roSetNext' = 'playout.roSetNext',
		'roMoveNext' = 'playout.roMoveNext',
		'roActivateHold' = 'playout.roActivateHold',
		'roStoriesMoved' = 'playout.roStoriesMoved',
		'roDisableNextSegmentLineItem' = 'playout.roDisableNextSegmentLineItem',
		'segmentLinePlaybackStartedCallback' = 'playout.segmentLinePlaybackStartedCallback',
		'segmentLineItemPlaybackStartedCallback' = 'playout.segmentLineItemPlaybackStartedCallback',
		'segmentAdLibLineItemStart' = 'playout.segmentAdLibLineItemStart',
		'runningOrderBaselineAdLibItemStart' = 'playout.runningOrderBaselineAdLibItemStart',
		'segmentAdLibLineItemStop' = 'playout.segmentAdLibLineItemStop',
		'sourceLayerOnLineStop' = 'playout.sourceLayerOnLineStop',
		'sourceLayerStickyItemStart' = 'playout.sourceLayerStickyItemStart',
		'timelineTriggerTimeUpdateCallback' = 'playout.timelineTriggerTimeUpdateCallback'
	}
}

export enum LookaheadMode {
	NONE = 0,
	PRELOAD = 1,
	RETAIN = 2
}
