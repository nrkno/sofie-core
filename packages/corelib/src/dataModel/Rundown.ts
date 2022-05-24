import { RundownPlaylistTiming, Time } from '@sofie-automation/blueprints-integration'
import {
	RundownId,
	OrganizationId,
	StudioId,
	ShowStyleBaseId,
	PeripheralDeviceId,
	RundownPlaylistId,
	ShowStyleVariantId,
} from './Ids'
import { RundownNote } from './Notes'

export interface RundownImportVersions {
	studio: string
	showStyleBase: string
	showStyleVariant: string
	blueprint: string

	core: string
}

/** This is a very uncomplete mock-up of the Rundown object */
export interface Rundown {
	_id: RundownId
	/** ID of the organization that owns the rundown */
	organizationId: OrganizationId | null
	/** The id of the Studio this rundown is in */
	studioId: StudioId

	externalId: string
	/** Rundown slug - user-presentable name */
	name: string

	/** Rundown description: Longer user-presentable description of the rundown */
	description?: string

	/** The ShowStyleBase this Rundown uses (its the parent of the showStyleVariant) */
	showStyleBaseId: ShowStyleBaseId
	showStyleVariantId: ShowStyleVariantId
	/** The peripheral device the rundown originates from */
	peripheralDeviceId?: PeripheralDeviceId
	restoredFromSnapshotId?: RundownId
	created: Time
	modified: Time

	/** Revisions/Versions of various docs that when changed require the user to reimport the rundown */
	importVersions: RundownImportVersions

	status?: string
	// There should be something like a Owner user here somewhere?

	/** Is the rundown in an unsynced (has been unpublished from ENPS) state? */
	orphaned?: 'deleted' | 'from-snapshot' | 'manual'

	/** Last sent storyStatus to ingestDevice (MOS) */
	notifiedCurrentPlayingPartExternalId?: string

	/** Holds notes (warnings / errors) thrown by the blueprints during creation, or appended after */
	notes?: Array<RundownNote>

	/** External id of the Rundown Playlist to put this rundown in */
	playlistExternalId?: string
	/** Whether the end of the rundown marks a commercial break */
	endOfRundownIsShowBreak?: boolean
	/** Name (user-facing) of the external NCS this rundown came from */
	externalNRCSName: string
	/** The id of the Rundown Playlist this rundown is in */
	playlistId: RundownPlaylistId
	/** If the playlistId has ben set manually by a user in Sofie */
	playlistIdIsSetInSofie?: boolean
	/** Whenever the baseline (RundownBaselineObjs, RundownBaselineAdLibItems, RundownBaselineAdLibActions) changes, this is changed too */
	baselineModifyHash?: string

	/** Rundown timing information */
	timing: RundownPlaylistTiming

	/** Arbitrary data storage for plugins */
	metaData?: unknown

	/** Air-status, comes from NCS, examples: "READY" | "NOT READY" */
	airStatus?: string
}

/** Note: Use Rundown instead */
export type DBRundown = Rundown
