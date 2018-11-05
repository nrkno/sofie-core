
export namespace RunningOrderAPI {
	/** The type of the source layer, used to enable specific functions for special-type layers */
	export enum SourceLayerType {
		UNKNOWN 		= 0,
		CAMERA 			= 1,
		VT 				= 2,
		REMOTE 			= 3,
		SCRIPT 			= 4,
		GRAPHICS 		= 5,
		SPLITS 			= 6,
		AUDIO 			= 7,
		CAMERA_MOVEMENT = 8,
		METADATA 		= 9,
		LOWER_THIRD		= 10,
		LIVE_SPEAK		= 11,
		MIC				= 12,
		TRANSITION		= 13,
		LIGHTS			= 14
	}

	/** A generic list of playback availability statuses for a source layer/line item */
	export enum LineItemStatusCode {
		/** No status has been determined (yet) */
		UNKNOWN = -1,
		/** No fault with item, can be played */
		OK = 0,
		/** The source (file, live input) is missing and cannot be played, as it would result in BTA */
		SOURCE_MISSING = 1,
		/** The source is present, but should not be played due to a technical malfunction (file is broken, camera robotics failed, REMOTE input is just bars, etc.) */
		SOURCE_BROKEN = 2
	}

	export enum methods {
		'removeRunningOrder' = 'rundown.removeRunningOrder',
		'resyncRunningOrder' = 'rundown.resyncRunningOrder'
	}
}
