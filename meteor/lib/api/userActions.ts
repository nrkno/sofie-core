export namespace UserActionAPI {
	/**
	 * These methods are intended to be called by a user,
	 * and the server response will be of the type ClientAPI.ClientResponse
	 */
	export enum methods {
		'take' 									= 'userAction.take',
		'setNext' 								= 'userAction.setNext',
		'moveNext' 								= 'userAction.moveNext',

		'prepareForBroadcast' 					= 'userAction.prepareForBroadcast',
		'resetRunningOrder' 					= 'userAction.resetRunningOrder',
		'resetAndActivate' 						= 'userAction.resetAndActivate',
		'activate' 								= 'userAction.activate',
		'deactivate' 							= 'userAction.deactivate',
		'reloadData' 							= 'userAction.reloadData',

		'disableNextSegmentLineItem'			= 'userAction.disableNextSegmentLineItem',
		'toggleSegmentLineArgument'				= 'userAction.toggleSegmentLineArgument',
		'segmentLineItemTakeNow'				= 'userAction.segmentLineItemTakeNow',
		'setInOutPoints'						= 'userAction.segmentLineItemSetInOutPoints',

		'segmentAdLibLineItemStart'				= 'userAction.segmentAdLibLineItemStart',
		'sourceLayerOnLineStop'					= 'userAction.sourceLayerOnLineStop',
		'baselineAdLibItemStart'				= 'userAction.baselineAdLibItemStart',
		'segmentAdLibLineItemStop'				= 'userAction.segmentAdLibLineItemStop',

		'sourceLayerStickyItemStart'			= 'userAction.sourceLayerStickyItemStart',

		'activateHold'							= 'userAction.activateHold',

		'saveEvaluation' 						= 'userAction.saveEvaluation',

		// 'roStoriesMoved'						= 'userAction.roStoriesMoved',
		// 'segmentLinePlaybackStartedCallback'	= 'userAction.segmentLinePlaybackStartedCallback',
		// 'segmentLineItemPlaybackStartedCallback'= 'userAction.segmentLineItemPlaybackStartedCallback',

		'storeRunningOrderSnapshot'				= 'userAction.storeRunningOrderSnapshot',

		'removeRunningOrder'					= 'userAction.removeRunningOrder',
		'resyncRunningOrder'					= 'userAction.resyncRunningOrder',

		'recordStop'							= 'userAction.recordStop',
		'recordStart'							= 'userAction.recordStart',
		'recordDelete'							= 'userAction.recordDelete',

		'mediaRestartWorkflow'					= 'userAction.mediamanager.restartWorkflow',
		'mediaAbortWorkflow'					= 'userAction.mediamanager.abortWorkflow'
	}
}
