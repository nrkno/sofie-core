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
		'resetRundown' 							= 'userAction.resetRundown',
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
		'segmentAdLibPieceStop'					= 'userAction.segmentAdLibPieceStop',

		'sourceLayerStickyPieceStart'			= 'userAction.sourceLayerStickyPieceStart',

		'activateHold'							= 'userAction.activateHold',

		'saveEvaluation' 						= 'userAction.saveEvaluation',

		// 'partPlaybackStartedCallback'	= 'userAction.partPlaybackStartedCallback',
		// 'piecePlaybackStartedCallback'= 'userAction.piecePlaybackStartedCallback',

		'storeRundownSnapshot'				= 'userAction.storeRundownSnapshot',

		'removeRundown'						= 'userAction.removeRundown',
		'resyncRundown'						= 'userAction.resyncRundown',

		'recordStop'							= 'userAction.recordStop',
		'recordStart'							= 'userAction.recordStart',
		'recordDelete'							= 'userAction.recordDelete',

		'mediaRestartWorkflow'					= 'userAction.mediamanager.restartWorkflow',
		'mediaAbortWorkflow'					= 'userAction.mediamanager.abortWorkflow',
		'mediaRestartAllWorkflows'				= 'userAction.mediamanager.restartAllWorkflows',
		'mediaAbortAllWorkflows'				= 'userAction.mediamanager.abortAllWorkflows',
		'mediaPrioritizeWorkflow'				= 'userAction.mediamanager.mediaPrioritizeWorkflow',

		'regenerateRundown'					= 'userAction.ingest.regenerateRundown',

		'generateRestartToken'				= 'userAction.system.generateRestartToken',
		'restartCore'						= 'userAction.system.restartCore',

		'guiFocused'						= 'guiState.focused',
		'guiBlurred'						= 'guiState.blurred'
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
}
