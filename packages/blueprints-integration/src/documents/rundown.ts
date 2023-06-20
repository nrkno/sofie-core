import type { RundownPlaylistTiming } from './playlistTiming'

/** The Rundown generated from Blueprint */

export interface IBlueprintRundown<TMetadata = unknown> {
	externalId: string
	/** Rundown slug - user-presentable name */
	name: string

	/** Rundown description: Longer user-presentable description of the rundown */
	description?: string

	/** Rundown timing information */
	timing: RundownPlaylistTiming

	/** Arbitrary data storage for plugins */
	metaData?: TMetadata

	/** A hint to the Core that the Rundown should be a part of a playlist */
	playlistExternalId?: string
}
/** The Rundown sent from Core */

export interface IBlueprintRundownDB<TMetadata = unknown>
	extends IBlueprintRundown<TMetadata>,
		IBlueprintRundownDBData {}
/** Properties added to a rundown in Core */

export interface IBlueprintRundownDBData {
	_id: string

	/** Id of the showStyle variant used */
	showStyleVariantId: string

	/** RundownPlaylist this rundown is member of */
	playlistId?: string

	/** Air-status, comes from NCS, examples: "READY" | "NOT READY" */
	airStatus?: string
}

export interface IBlueprintSegmentRundown<TMetadata = unknown> {
	externalId: string

	/** Arbitrary data storage for plugins */
	metaData?: TMetadata
}
