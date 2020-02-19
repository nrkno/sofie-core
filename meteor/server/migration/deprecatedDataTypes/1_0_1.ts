import { Time, literal } from '../../../lib/lib'
import { RundownImportVersions, RundownHoldState, DBRundown } from '../../../lib/collections/Rundowns'
import { RundownNote } from '../../../lib/api/notes'
import { TimelinePersistentState } from 'tv-automation-sofie-blueprints-integration'
import { DBRundownPlaylist } from '../../../lib/collections/RundownPlaylists'

export interface Rundown {
	externalId: string
	name: string
	expectedStart?: Time
	expectedDuration?: number
	metaData?: {
		[key: string]: any
	}
	// From IBlueprintRundownDB:
	_id: string
	showStyleVariantId: string
	// From DBRundown:
	studioId: string
	showStyleBaseId: string
	peripheralDeviceId: string
	created: Time
	modified: Time
	importVersions: RundownImportVersions
	status?: string
	airStatus?: string
	active?: boolean
	rehearsal?: boolean
	currentPartId: string | null
	nextPartId: string | null
	nextTimeOffset?: number | null
	nextPartManual?: boolean
	previousPartId: string | null
	startedPlayback?: Time
	unsynced?: boolean
	unsyncedTime?: Time
	notifiedCurrentPlayingPartExternalId?: string
	holdState?: RundownHoldState
	dataSource: string
	notes?: Array<RundownNote>
	previousPersistentState?: TimelinePersistentState
}
export function makePlaylistFromRundown_1_0_0 (rundown0: DBRundown, newPlaylistId?: string): DBRundownPlaylist {
	const rundown = rundown0 as any as Rundown
	if (!newPlaylistId) newPlaylistId = 'pl_' + rundown._id
	const playlist = literal<DBRundownPlaylist>({
		_id: newPlaylistId,
		externalId: rundown.externalId,
		active: rundown['active'],
		rehearsal: rundown['rehearsal'],
		created: rundown.created,
		currentPartInstanceId: null,
		nextPartInstanceId: null,
		expectedDuration: rundown.expectedDuration,
		expectedStart: rundown.expectedStart,
		holdState: rundown.holdState,
		name: rundown.name,
		nextPartManual: rundown.nextPartManual,
		nextTimeOffset: rundown.nextTimeOffset,
		peripheralDeviceId: rundown.peripheralDeviceId,
		previousPartInstanceId: null,
		startedPlayback: rundown.startedPlayback,
		studioId: rundown.studioId,
		modified: rundown.modified
	})
	return playlist
}
