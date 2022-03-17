import { Time, TimelinePersistentState, RundownPlaylistTiming } from '@sofie-automation/blueprints-integration'
import {
	PartId,
	PieceInstanceInfiniteId,
	PartInstanceId,
	SegmentId,
	RundownPlaylistActivationId,
	OrganizationId,
	RundownPlaylistId,
	StudioId,
} from './Ids'

/** Details of an ab-session requested by the blueprints in onTimelineGenerate */
export interface ABSessionInfo {
	/** The unique id of the session. */
	id: string
	/** The name of the session from the blueprints */
	name: string
	/** Set if the session is being by lookahead for a future part */
	lookaheadForPartId?: PartId
	/** Set if the session is being used by an infinite PieceInstance */
	infiniteInstanceId?: PieceInstanceInfiniteId
	/** Set to the PartInstances this session is used by, if not just used for lookahead */
	partInstanceIds?: Array<PartInstanceId>
}

export enum RundownHoldState {
	NONE = 0,
	PENDING = 1, // During STK
	ACTIVE = 2, // During full, STK is played
	COMPLETE = 3, // During full, full is played
}

export interface DBRundownPlaylist {
	_id: RundownPlaylistId
	/** External ID (source) of the playlist */
	externalId: string
	/** ID of the organization that owns the playlist */
	organizationId?: OrganizationId | null
	/** Studio that this playlist is assigned to */
	studioId: StudioId

	restoredFromSnapshotId?: RundownPlaylistId

	/** A name to be displayed to the user */
	name: string
	/** Created timestamp */
	created: Time
	/** Last modified timestamp */
	modified: Time
	/** Rundown timing information */
	timing: RundownPlaylistTiming
	/** Is the playlist in rehearsal mode (can be used, when active: true) */
	rehearsal?: boolean
	/** Playout hold state */
	holdState?: RundownHoldState
	/** Truthy when the playlist is currently active in the studio. This is regenerated upon each activation/reset. */
	activationId?: RundownPlaylistActivationId
	/** Should the playlist loop at the end */
	loop?: boolean
	/** Marker indicating if unplayed parts behind the onAir part, should be treated as "still to be played" or "skipped" in terms of timing calculations */
	outOfOrderTiming?: boolean
	/** Should time-of-day clocks be used instead of countdowns by default */
	timeOfDayCountdowns?: boolean
	/** Arbitraty data used by rundowns */
	metaData?: unknown

	/** the id of the Live Part - if empty, no part in this rundown is live */
	currentPartInstanceId: PartInstanceId | null
	/** the id of the Next Part - if empty, no segment will follow Live Part */
	nextPartInstanceId: PartInstanceId | null
	/** The time offset of the next line */
	nextTimeOffset?: number | null
	/** if nextPartId was set manually (ie from a user action) */
	nextPartManual?: boolean
	/** the id of the Previous Part */
	previousPartInstanceId: PartInstanceId | null

	/** The id of the Next Segment. If set, the Next point will jump to that segment when moving out of currently playing segment. */
	nextSegmentId?: SegmentId

	/** Actual time of playback starting */
	startedPlayback?: Time
	/** Timestamp for the last time an incorrect part was reported as started */
	lastIncorrectPartPlaybackReported?: Time
	/** Actual time of each rundown starting playback */
	rundownsStartedPlayback?: Record<string, Time>

	/** If the _rank of rundowns in this playlist has ben set manually by a user in Sofie */
	rundownRanksAreSetInSofie?: boolean

	/** Previous state persisted from ShowStyleBlueprint.onTimelineGenerate */
	previousPersistentState?: TimelinePersistentState
	/** AB playback sessions calculated in the last call to ShowStyleBlueprint.onTimelineGenerate */
	trackedAbSessions?: ABSessionInfo[]
}
