export enum PlayoutTimelinePrefixes {
	SEGMENT_LINE_GROUP_PREFIX = 'sl_group_',
	SEGMENT_LINE_GROUP_FIRST_ITEM_PREFIX = 'sl_group_firstobject_',
	SEGMENT_LINE_ITEM_GROUP_PREFIX = 'sli_group_',
	SEGMENT_LINE_ITEM_GROUP_FIRST_ITEM_PREFIX = 'sli_group_firstobject_',
}

export namespace PlayoutAPI {
	export enum methods {
		'reloadData' = 'playout_reload_data',
		'roActivate' = 'playout_activate',
		/**
		 * Inactivates the RunningOrder
		 * TODO: Clear the Timeline (?)
		 */
		'roDeactivate' = 'playout_inactivate',
		/**
		 * Perform the TAKE action, i.e start playing a segmentLineItem
		 */
		'roTake' = 'playout_take',
		'roSetNext' = 'playout_setNext',
		'roStoriesMoved' = 'playout_storiesMoved',
		'segmentLinePlaybackStartedCallback' = 'playout_segmentLinePlaybackStart',
		'segmentLineItemPlaybackStartedCallback' = 'playout_segmentLineItemPlaybackStart',
		'segmentAdLibLineItemStart' = 'playout_segmentAdLibLineItemStart',
		'runningOrderBaselineAdLibItemStart' = 'playout_runningOrderBaselineAdLibItemStart',
		'segmentAdLibLineItemStop' = 'playout_segmentAdLibLineItemStop',
		'sourceLayerOnLineStop' = 'playout_sourceLayerOnLineStop',
		'timelineTriggerTimeUpdateCallback' = 'playout_timelineTriggerTimeUpdate'
	}
}
