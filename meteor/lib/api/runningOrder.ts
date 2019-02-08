export namespace RunningOrderAPI {
	/** A generic list of playback availability statuses for a source layer/line item */
	export enum LineItemStatusCode {
		/** No status has been determined (yet) */
		UNKNOWN = -1,
		/** No fault with item, can be played */
		OK = 0,
		/** The source (file, live input) is missing and cannot be played, as it would result in BTA */
		SOURCE_MISSING = 1,
		/** The source is present, but should not be played due to a technical malfunction (file is broken, camera robotics failed, REMOTE input is just bars, etc.) */
		SOURCE_BROKEN = 2,
		/** Source not set - the source object is not set to an actual source */
		SOURCE_NOT_SET = 3
	}

	export enum methods {
		'removeRunningOrder' = 'rundown.removeRunningOrder',
		'resyncRunningOrder' = 'rundown.resyncRunningOrder',
		'unsyncRunningOrder' = 'rundown.unsyncRunningOrder',
		'runningOrderNeedsUpdating' = 'rundown.runningOrderNeedsUpdating'
	}
}
