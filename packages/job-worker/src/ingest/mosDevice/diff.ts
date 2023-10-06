import { JobContext } from '../../jobs'
import { ReadonlyDeep } from 'type-fest'
import { CacheForIngest } from '../cache'
import { LocalIngestRundown, LocalIngestSegment } from '../ingestCache'
import { canRundownBeUpdated, getRundown, getSegmentId } from '../lib'
import { calculateSegmentsFromIngestData, saveSegmentChangesToCache } from '../generationSegment'
import _ = require('underscore')
import { clone, deleteAllUndefinedProperties, literal, normalizeArray } from '@sofie-automation/corelib/dist/lib'
import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { IngestSegment } from '@sofie-automation/blueprints-integration'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { CommitIngestData } from '../lock'
import { removeSegmentContents } from '../cleanup'

/**
 * Update the Ids of Segments based on new Ingest data
 * This assumes that no segments/parts were added or removed between the two LocalIngestRundowns provided
 * @param context Context of the job being run
 * @param cache Ingest cache for Rundown being updated
 * @param oldIngestRundown Last known ingest data
 * @param newIngestRundown New ingest data
 * @returns Map of the SegmentId changes
 */
export function diffAndUpdateSegmentIds(
	context: JobContext,
	cache: CacheForIngest,
	oldIngestRundown: ReadonlyDeep<LocalIngestRundown>,
	newIngestRundown: ReadonlyDeep<LocalIngestRundown>
): CommitIngestData['renamedSegments'] {
	const span = context.startSpan('mosDevice.ingest.diffAndApplyChanges')

	const oldSegments = cache.Segments.findAll(null)
	const oldSegmentEntries = compileSegmentEntries(oldIngestRundown.segments)
	const newSegmentEntries = compileSegmentEntries(newIngestRundown.segments)
	const segmentDiff = diffSegmentEntries(oldSegmentEntries, newSegmentEntries, oldSegments)

	// Updated segments that has had their segment.externalId changed:
	const renamedSegments = applyExternalIdDiff(cache, segmentDiff)

	span?.end()
	return renamedSegments
}

/**
 * Update the Rundown for new Ingest data
 * Performs a diff of the ingest data, and applies the changes including re-running blueprints on any changed segments
 * @param context Context of the job being run
 * @param cache Ingest cache for Rundown being updated
 * @param newIngestRundown New ingest data (if any)
 * @param oldIngestRundown Last known ingest data (if any)
 * @returns Map of the SegmentId changes
 */
export async function diffAndApplyChanges(
	context: JobContext,
	cache: CacheForIngest,
	newIngestRundown: ReadonlyDeep<LocalIngestRundown> | undefined,
	oldIngestRundown: ReadonlyDeep<LocalIngestRundown> | undefined
	// newIngestParts: AnnotatedIngestPart[]
): Promise<CommitIngestData | null> {
	if (!newIngestRundown) throw new Error(`diffAndApplyChanges lost the new IngestRundown...`)
	if (!oldIngestRundown) throw new Error(`diffAndApplyChanges lost the old IngestRundown...`)

	const rundown = getRundown(cache)
	if (!canRundownBeUpdated(rundown, false)) return null

	const span = context.startSpan('mosDevice.ingest.diffAndApplyChanges')

	// Fetch all existing segments:
	const oldSegments = cache.Segments.findAll(null)

	const oldSegmentEntries = compileSegmentEntries(oldIngestRundown.segments)
	const newSegmentEntries = compileSegmentEntries(newIngestRundown.segments)
	const segmentDiff = diffSegmentEntries(oldSegmentEntries, newSegmentEntries, oldSegments)

	// Note: We may not need to do some of these quick updates anymore, but they are cheap so can stay for now

	// Update segment ranks:
	_.each(segmentDiff.onlyRankChanged, (newRank, segmentExternalId) => {
		cache.Segments.updateOne(getSegmentId(rundown._id, segmentExternalId), (s) => {
			s._rank = newRank
			return s
		})
	})

	// Updated segments that has had their segment.externalId changed:
	const renamedSegments = applyExternalIdDiff(cache, segmentDiff)

	// Figure out which segments need to be regenerated
	const segmentsToRegenerate = Object.values(segmentDiff.added)
	for (const changedSegment of Object.values(segmentDiff.changed)) {
		// Rank changes are handled above
		if (!segmentDiff.onlyRankChanged[changedSegment.externalId]) {
			segmentsToRegenerate.push(changedSegment)
		}
	}

	// Create/Update segments
	const segmentChanges = await calculateSegmentsFromIngestData(
		context,
		cache,
		_.sortBy(segmentsToRegenerate, (se) => se.rank),
		null
	)

	// Remove/orphan old segments
	const segmentIdsToRemove = new Set(Object.keys(segmentDiff.removed).map((id) => getSegmentId(rundown._id, id)))
	// We orphan it and queue for deletion. the commit phase will complete if possible
	const orphanedSegmentIds = cache.Segments.updateAll((s) => {
		if (segmentIdsToRemove.has(s._id)) {
			s.orphaned = SegmentOrphanedReason.DELETED
			return s
		} else {
			return false
		}
	})

	if (!context.studio.settings.preserveUnsyncedPlayingSegmentContents) {
		// Remove everything inside the segment
		removeSegmentContents(cache, segmentIdsToRemove)
	}

	saveSegmentChangesToCache(context, cache, segmentChanges, false)

	span?.end()
	return literal<CommitIngestData>({
		changedSegmentIds: segmentChanges.segments.map((s) => s._id),
		removedSegmentIds: orphanedSegmentIds, // Only inform about the ones that werent renamed
		renamedSegments: renamedSegments,

		removeRundown: false,
	})
}

/**
 * Apply the externalId renames from a DiffSegmentEntries
 * @param cache Ingest cache of the rundown being updated
 * @param segmentDiff Calculated Diff
 * @returns Map of the SegmentId changes
 */
function applyExternalIdDiff(
	cache: CacheForIngest,
	segmentDiff: Pick<DiffSegmentEntries, 'externalIdChanged'>
): CommitIngestData['renamedSegments'] {
	// Updated segments that has had their segment.externalId changed:
	const renamedSegments = new Map<SegmentId, SegmentId>()
	_.each(segmentDiff.externalIdChanged, (newSegmentExternalId, oldSegmentExternalId) => {
		const oldSegmentId = getSegmentId(cache.RundownId, oldSegmentExternalId)
		const newSegmentId = getSegmentId(cache.RundownId, newSegmentExternalId)

		// Some data will be orphaned temporarily, but will be picked up/cleaned up before the cache gets saved

		const oldSegment = cache.Segments.findOne(oldSegmentId)
		renamedSegments.set(oldSegmentId, newSegmentId)
		if (oldSegment) {
			cache.Segments.remove(oldSegmentId)
			cache.Segments.replace({
				...oldSegment,
				_id: newSegmentId,
			})
		}
	})

	// Move over those parts to the new segmentId.
	for (const part of cache.Parts.findAll(null)) {
		const newSegmentId = renamedSegments.get(part.segmentId)
		if (newSegmentId) {
			part.segmentId = newSegmentId
			cache.Parts.replace(part)
		}
	}
	for (const piece of cache.Pieces.findAll(null)) {
		const newSegmentId = renamedSegments.get(piece.startSegmentId)
		if (newSegmentId) {
			piece.startSegmentId = newSegmentId
			cache.Pieces.replace(piece)
		}
	}

	return renamedSegments
}

/**
 * Object of IngestSegment against their external ids
 */
export type SegmentEntries = { [segmentExternalId: string]: LocalIngestSegment }
/**
 * Convert an array of IngestSegment into SegmentEntries
 */
export function compileSegmentEntries(ingestSegments: ReadonlyDeep<Array<LocalIngestSegment>>): SegmentEntries {
	const segmentEntries: SegmentEntries = {}

	for (const ingestSegment of ingestSegments) {
		if (segmentEntries[ingestSegment.externalId]) {
			throw new Error(`compileSegmentEntries: Non-unique segment external ID: "${ingestSegment.externalId}"`)
		}
		segmentEntries[ingestSegment.externalId] = clone<LocalIngestSegment>(ingestSegment)
	}

	return segmentEntries
}

/**
 * Result of diffing two SegmentEntries
 */
export interface DiffSegmentEntries {
	added: { [segmentExternalId: string]: LocalIngestSegment }
	changed: { [segmentExternalId: string]: LocalIngestSegment }
	removed: { [segmentExternalId: string]: LocalIngestSegment }
	unchanged: { [segmentExternalId: string]: LocalIngestSegment }

	// Note: The objects present below are also present in the collections above

	/** Reference to segments which only had their ranks updated */
	onlyRankChanged: { [segmentExternalId: string]: number } // contains the new rank

	/** Reference to segments which has been REMOVED, but it looks like there is an ADDED segment that is closely related to the removed one */
	externalIdChanged: { [removedSegmentExternalId: string]: string } // contains the added segment's externalId
}

/**
 * Perform a diff of SegmentEntries, to calculate what has changed.
 * Considers that the ids of some IngestSegments could have changed
 * @param oldSegmentEntries The last known SegmentEntries
 * @param newSegmentEntries The new SegmentEntries
 * @param oldSegments The Segments in the DB. This allows for maintaining a stable modified timestamp, and ranks
 * @returns DiffSegmentEntries describing the found changes
 */
export function diffSegmentEntries(
	oldSegmentEntries: SegmentEntries,
	newSegmentEntries: SegmentEntries,
	oldSegments: DBSegment[] | null
): DiffSegmentEntries {
	const diff: DiffSegmentEntries = {
		added: {},
		changed: {},
		removed: {},
		unchanged: {},

		onlyRankChanged: {},
		externalIdChanged: {},
	}
	const oldSegmentMap: { [externalId: string]: DBSegment } | null =
		oldSegments === null ? null : normalizeArray(oldSegments, 'externalId')

	_.each(newSegmentEntries, (newSegmentEntry, segmentExternalId) => {
		const oldSegmentEntry = oldSegmentEntries[segmentExternalId] as IngestSegment | undefined
		let oldSegment: DBSegment | undefined
		if (oldSegmentMap) {
			oldSegment = oldSegmentMap[newSegmentEntry.externalId]
			if (!oldSegment) {
				// Segment has been added
				diff.added[segmentExternalId] = newSegmentEntry
				return
			}
		}
		if (oldSegmentEntry) {
			const modifiedIsEqual = oldSegment ? newSegmentEntry.modified === oldSegment.externalModified : true

			// ensure there are no 'undefined' properties
			deleteAllUndefinedProperties(oldSegmentEntry)
			deleteAllUndefinedProperties(newSegmentEntry)

			// deep compare:
			const ingestContentIsEqual = _.isEqual(_.omit(newSegmentEntry, 'rank'), _.omit(oldSegmentEntry, 'rank'))
			const rankIsEqual = oldSegment
				? newSegmentEntry.rank === oldSegment._rank
				: newSegmentEntry.rank === oldSegmentEntry.rank

			// Compare the modified timestamps:
			if (modifiedIsEqual && ingestContentIsEqual && rankIsEqual) {
				diff.unchanged[segmentExternalId] = newSegmentEntry
			} else {
				// Something has changed
				diff.changed[segmentExternalId] = newSegmentEntry

				// Check if it's only the rank that has changed:
				if (ingestContentIsEqual && !rankIsEqual) {
					diff.onlyRankChanged[segmentExternalId] = newSegmentEntry.rank
				}
			}
		} else {
			// Segment has been added
			diff.added[segmentExternalId] = newSegmentEntry
		}
	})

	_.each(oldSegmentEntries, (oldSegmentEntry, segmentExternalId) => {
		const newSegmentEntry = newSegmentEntries[segmentExternalId] as IngestSegment | undefined
		if (!newSegmentEntry) {
			diff.removed[segmentExternalId] = oldSegmentEntry
		}
	})

	// Handle when the externalId has change
	_.each(diff.removed, (segmentEntry, segmentExternalId) => {
		// try finding "it" in the added, using name
		let newSegmentEntry = _.find(diff.added, (se) => se.name === segmentEntry.name)
		if (!newSegmentEntry) {
			// second try, match with any parts:
			newSegmentEntry = _.find(diff.added, (se) => {
				let found = false
				_.each(segmentEntry.parts, (part) => {
					if (found || _.find(se.parts, (p) => p.externalId === part.externalId)) {
						found = true
					}
				})
				return found
			})
		}
		if (newSegmentEntry) {
			diff.externalIdChanged[segmentExternalId] = newSegmentEntry.externalId
		}
	})

	return diff
}
