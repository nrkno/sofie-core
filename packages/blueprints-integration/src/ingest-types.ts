import { IngestPart, IngestPlaylist, IngestRundown, IngestSegment } from './ingest'

export interface SofieIngestPlaylist extends IngestPlaylist {
	/** Ingest cache of rundowns in this playlist. */
	rundowns: SofieIngestRundown[]
}
export interface SofieIngestRundown<TRundownPayload = unknown, TSegmentPayload = unknown, TPartPayload = unknown>
	extends IngestRundown<TRundownPayload, TSegmentPayload, TPartPayload> {
	/** Array of segments in this rundown */
	segments: SofieIngestSegment<TSegmentPayload, TPartPayload>[]

	/** States for UserEdits, could be lock from NRCS updates,
	 * lock from user changes,
	 * or removedByUser
	 * */
	userEditStates: Record<string, boolean>
}
export interface SofieIngestSegment<TSegmentPayload = unknown, TPartPayload = unknown>
	extends IngestSegment<TSegmentPayload, TPartPayload> {
	/** Array of parts in this segment */
	parts: SofieIngestPart<TPartPayload>[]

	/** States for UserEdits, could be lock from NRCS updates,
	 * lock from user changes,
	 * or removedByUser
	 * */
	userEditStates: Record<string, boolean>
}
export interface SofieIngestPart<TPayload = unknown> extends IngestPart<TPayload> {
	/** States for UserEdits, could be lock from NRCS updates,
	 * lock from user changes,
	 * or removedByUser
	 * */
	userEditStates: Record<string, boolean>
}
