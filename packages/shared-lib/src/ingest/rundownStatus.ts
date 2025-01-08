import type { RundownId } from '../core/model/Ids'

export interface IngestRundownStatus {
	_id: RundownId

	/** Rundown external id */
	externalId: string

	active: IngestRundownActiveStatus

	segments: IngestSegmentStatus[]
}

export enum IngestRundownActiveStatus {
	ACTIVE = 'active',
	REHEARSAL = 'rehearsal',
	INACTIVE = 'inactive',
}

export interface IngestSegmentStatus {
	/** Segment external id */
	externalId: string

	parts: IngestPartStatus[]
}

export interface IngestPartStatus {
	/** Part external id */
	externalId: string

	isReady: boolean | null

	itemsReady: Record<string, boolean | undefined>

	playbackStatus: IngestPartPlaybackStatus
}

export enum IngestPartPlaybackStatus {
	UNKNOWN = 'unknown',
	PLAY = 'play',
	STOP = 'stop',
}
