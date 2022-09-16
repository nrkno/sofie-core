import { PartId, RundownId, SegmentId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { getHash } from '@sofie-automation/corelib/dist/lib'
import { isProtectedString, protectString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadOnlyCache } from '../cache/CacheBase'
import { ReadonlyDeep } from 'type-fest'
import { CacheForIngest } from './cache'
import { logger } from '../logging'
import { ExtendedIngestRundown, IngestRundown } from '@sofie-automation/blueprints-integration'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { convertRundownToBlueprints } from '../blueprints/context/lib'

export function getRundownId(studio: ReadonlyDeep<DBStudio> | StudioId, rundownExternalId: string): RundownId {
	if (!studio) throw new Error('getRundownId: studio not set!')
	if (!rundownExternalId) throw new Error('getRundownId: rundownExternalId must be set!')
	return protectString<RundownId>(getHash(`${isProtectedString(studio) ? studio : studio._id}_${rundownExternalId}`))
}
export function getSegmentId(rundownId: RundownId, segmentExternalId: string): SegmentId {
	if (!rundownId) throw new Error('getSegmentId: rundownId must be set!')
	if (!segmentExternalId) throw new Error('getSegmentId: segmentExternalId must be set!')
	return protectString<SegmentId>(getHash(`${rundownId}_segment_${segmentExternalId}`))
}
export function getPartId(rundownId: RundownId, partExternalId: string): PartId {
	if (!rundownId) throw new Error('getPartId: rundownId must be set!')
	if (!partExternalId) throw new Error('getPartId: partExternalId must be set!')
	return protectString<PartId>(getHash(`${rundownId}_part_${partExternalId}`))
}

export function getRundown(cache: ReadOnlyCache<CacheForIngest> | CacheForIngest): ReadonlyDeep<DBRundown> {
	const rundown = cache.Rundown.doc
	if (!rundown) {
		throw new Error(`Rundown "${cache.RundownId}" ("${cache.RundownExternalId}") not found`)
	}
	return rundown
}

export function canRundownBeUpdated(rundown: ReadonlyDeep<DBRundown> | undefined, isCreateAction: boolean): boolean {
	if (!rundown) return true
	if (rundown.orphaned && !isCreateAction) {
		logger.info(`Rundown "${rundown._id}" has been unsynced and needs to be synced before it can be updated.`)
		return false
	}
	return true
}
export function canSegmentBeUpdated(
	rundown: ReadonlyDeep<DBRundown> | undefined,
	segment: ReadonlyDeep<DBSegment> | undefined,
	isCreateAction: boolean
): boolean {
	if (!canRundownBeUpdated(rundown, false)) {
		return false
	}

	if (!segment) return true
	if (segment.orphaned === SegmentOrphanedReason.DELETED && !isCreateAction) {
		logger.info(`Segment "${segment._id}" has been unsynced and needs to be synced before it can be updated.`)
		return false
	}

	return true
}

export function extendIngestRundownCore(
	ingestRundown: IngestRundown,
	existingDbRundown: ReadonlyDeep<DBRundown> | undefined
): ExtendedIngestRundown {
	const extendedIngestRundown: ExtendedIngestRundown = {
		...ingestRundown,
		coreData: existingDbRundown && convertRundownToBlueprints(existingDbRundown),
	}
	return extendedIngestRundown
}
