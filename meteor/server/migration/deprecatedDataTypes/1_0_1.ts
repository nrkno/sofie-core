import { Time } from '../../../lib/lib'
import { RundownImportVersions, RundownHoldState } from '../../../lib/collections/Rundowns'
import { RundownNote } from '../../../lib/api/notes'
import { TimelinePersistentState } from 'tv-automation-sofie-blueprints-integration'

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
