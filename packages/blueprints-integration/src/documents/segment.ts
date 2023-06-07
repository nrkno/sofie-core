export enum SegmentDisplayMode {
	Timeline = 'timeline',
	Storyboard = 'storyboard',
	List = 'list',
}

/** The Segment generated from Blueprint */
export interface IBlueprintSegment<TMetadata = unknown> {
	/** User-presentable name (Slug) for the Title */
	name: string
	/** Arbitrary data storage for plugins */
	metaData?: TMetadata
	/** Hide the Segment in the UI */
	isHidden?: boolean
	/** User-facing identifier that can be used by the User to identify the contents of a segment in the Rundown source system */
	identifier?: string

	/** Show the minishelf of the segment */
	showShelf?: boolean
	/** Segment display mode. Default mode is *SegmentDisplayMode.Timeline* */
	displayAs?: SegmentDisplayMode
}
/** The Segment sent from Core */
export interface IBlueprintSegmentDB<TMetadata = unknown> extends IBlueprintSegment<TMetadata> {
	_id: string
}
