export interface IngestPlaylist {
	/** Id of the playlist. */
	externalId: string
	/** Ingest cache of rundowns in this playlist. */
	rundowns: IngestRundown[]
}
export interface IngestRundown {
	/** Id of the rundown as reported by the ingest gateway. Must be unique for each rundown owned by the gateway */
	externalId: string
	/** Name of the rundown */
	name: string

	/** Something that identified the data source. eg "spreadsheet", "mos" */
	type: string

	/** Raw payload of rundown metadata. Only used by the blueprints */
	payload?: any

	/** Array of segmsnts in this rundown */
	segments: IngestSegment[]
}
export interface IngestSegment {
	/** Id of the segment as reported by the ingest gateway. Must be unique for each segment in the rundown */
	externalId: string
	/** Name of the segment */
	name: string
	rank: number

	/** Raw payload of segment metadata. Only used by the blueprints */
	payload?: any

	/** Array of parts in this segment */
	parts: IngestPart[]
}
export interface IngestPart {
	/** Id of the part as reported by the ingest gateway. Must be unique for each part in the rundown */
	externalId: string
	/** Name of the part */
	name: string
	/** Rank of the part within the segmetn */
	rank: number

	/** Raw payload of the part. Only used by the blueprints */
	payload?: any
}

export interface IngestAdlib {
	/** Id of the adlib as reported by the ingest source. Must be unique for each adlib */
	externalId: string
	/** Name of the adlib */
	name: string

	/** Type of the raw payload. Only used by the blueprints */
	payloadType: string
	/** Raw payload of the adlib. Only used by the blueprints */
	payload?: any
}
