export enum SegmentDisplayMode {
	Timeline = 'timeline',
	Storyboard = 'storyboard',
	List = 'list',
}

export interface SegmentTimingInfo {
	/** A unix timestamp of when the segment is expected to begin. Affects rundown timing. */
	expectedStart?: number

	/** A unix timestamp of when the segment is expected to end. Affects rundown timing. */
	expectedEnd?: number
}

/** The Segment generated from Blueprint */
export interface IBlueprintSegment<TPrivateData = unknown, TPublicData = unknown> {
	/** User-presentable name (Slug) for the Title */
	name: string
	/** Arbitraty data storage for internal use in the blueprints */
	privateData?: TPrivateData
	/** Arbitraty data relevant for other systems, made available to them through APIs */
	publicData?: TPublicData
	/** Hide the Segment in the UI */
	isHidden?: boolean
	/** User-facing identifier that can be used by the User to identify the contents of a segment in the Rundown source system */
	identifier?: string

	/** Show the minishelf of the segment */
	showShelf?: boolean
	/** Segment display mode. Default mode is *SegmentDisplayMode.Timeline* */
	displayAs?: SegmentDisplayMode

	/** Contains properties related to the timing of the segment */
	segmentTiming?: SegmentTimingInfo
}
/** The Segment sent from Core */
export interface IBlueprintSegmentDB<TPrivateData = unknown, TPublicData = unknown>
	extends IBlueprintSegment<TPrivateData, TPublicData> {
	_id: string
}
