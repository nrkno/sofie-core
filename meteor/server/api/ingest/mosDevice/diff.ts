import { IngestSegment } from '@sofie-automation/blueprints-integration'
import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import _ from 'underscore'
import { SegmentId, Segment } from '../../../../lib/collections/Segments'
import { clone, literal, normalizeArray } from '../../../../lib/lib'
import { Settings } from '../../../../lib/Settings'
import { profiler } from '../../profiler'
import { CacheForIngest } from '../cache'
import { removeSegmentContents } from '../cleanup'
import { calculateSegmentsFromIngestData, saveSegmentChangesToCache } from '../generation'
import { LocalIngestRundown, LocalIngestSegment } from '../ingestCache'
import { getRundown, getSegmentId } from '../lib'
import { CommitIngestData } from '../syncFunction'

export function diffAndUpdateSegmentIds(
	cache: CacheForIngest,
	oldIngestRundown: ReadonlyDeep<LocalIngestRundown>,
	newIngestRundown: ReadonlyDeep<LocalIngestRundown>
): CommitIngestData['renamedSegments'] {
	const span = profiler.startSpan('mosDevice.ingest.diffAndApplyChanges')

	// TODO this is a duplicate of a loop found in diffAndApplyChanges but modified to not run against a cache.
	// This should be improved once the caches change, and we have access to one in time for this

	const oldSegments = cache.Segments.findFetch()
	const oldSegmentEntries = compileSegmentEntries(oldIngestRundown.segments)
	const newSegmentEntries = compileSegmentEntries(newIngestRundown.segments)
	const segmentDiff = diffSegmentEntries(oldSegmentEntries, newSegmentEntries, oldSegments)

	// Updated segments that has had their segment.externalId changed:
	const renamedSegments = applyExternalIdDiff(cache, segmentDiff)

	span?.end()
	return renamedSegments
}

export async function diffAndApplyChanges(
	cache: CacheForIngest,
	oldIngestRundown: ReadonlyDeep<LocalIngestRundown> | undefined,
	newIngestRundown: ReadonlyDeep<LocalIngestRundown> | undefined
	// newIngestParts: AnnotatedIngestPart[]
): Promise<CommitIngestData | null> {
	if (!newIngestRundown) throw new Meteor.Error(`handleMosDeleteStory lost the new IngestRundown...`)
	if (!oldIngestRundown) throw new Meteor.Error(`handleMosDeleteStory lost the old IngestRundown...`)

	const rundown = getRundown(cache)

	// TODO - this has been removed, are the modified times being updated correctly???
	// const newIngestRundown = updateIngestRundownWithData(oldIngestRundown, newIngestSegments)

	const span = profiler.startSpan('mosDevice.ingest.diffAndApplyChanges')

	// Fetch all existing segments:
	const oldSegments = cache.Segments.findFetch({ rundownId: rundown._id })

	const oldSegmentEntries = compileSegmentEntries(oldIngestRundown.segments)
	const newSegmentEntries = compileSegmentEntries(newIngestRundown.segments)
	const segmentDiff = diffSegmentEntries(oldSegmentEntries, newSegmentEntries, oldSegments)

	// TODO - do we need to do these 'clever' updates anymore? As we don't store any playout properties on the Parts, destroying and recreating won't have negative impacts?
	// The one exception is PartInstances when the segmentId changes, but that is handled by `updatePartInstancesBasicProperties()` as a general data integrity enforcement step

	// Update segment ranks:
	_.each(segmentDiff.onlyRankChanged, (newRank, segmentExternalId) => {
		cache.Segments.update(getSegmentId(rundown._id, segmentExternalId), {
			$set: {
				_rank: newRank,
			},
		})
	})

	// Updated segments that has had their segment.externalId changed:
	const renamedSegments = applyExternalIdDiff(cache, segmentDiff)

	// Create/Update segments
	const segmentChanges = await calculateSegmentsFromIngestData(
		cache,
		rundown,
		_.sortBy([...Object.values(segmentDiff.added), ...Object.values(segmentDiff.changed)], (se) => se.rank)
	)

	// Remove/orphan old segments
	const segmentIdsToRemove = new Set(Object.keys(segmentDiff.removed).map((id) => getSegmentId(rundown._id, id)))
	// We orphan it and queue for deletion. the commit phase will complete if possible
	cache.Segments.update((s) => segmentIdsToRemove.has(s._id), {
		$set: {
			orphaned: 'deleted',
		},
	})

	if (!Settings.allowUnsyncedSegments) {
		// Remove everything inside the segment
		removeSegmentContents(cache, segmentIdsToRemove)
	}

	await saveSegmentChangesToCache(cache, segmentChanges, false)

	span?.end()
	return literal<CommitIngestData>({
		changedSegmentIds: segmentChanges.segments.map((s) => s._id),
		removedSegmentIds: Array.from(segmentIdsToRemove),
		renamedSegments: renamedSegments,

		removeRundown: false,

		showStyle: segmentChanges.showStyle,
		blueprint: segmentChanges.blueprint,
	})
}

function applyExternalIdDiff(
	cache: CacheForIngest,
	segmentDiff: DiffSegmentEntries
): CommitIngestData['renamedSegments'] {
	// Updated segments that has had their segment.externalId changed:
	const renamedSegments = new Map<SegmentId, SegmentId>()
	_.each(segmentDiff.externalIdChanged, (newSegmentExternalId, oldSegmentExternalId) => {
		const oldSegmentId = getSegmentId(cache.RundownId, oldSegmentExternalId)
		const newSegmentId = getSegmentId(cache.RundownId, newSegmentExternalId)

		// Some data will be orphaned temporarily, but will be picked up/cleaned up before the cache gets saved

		// TODO ORPHAN - can this be done in a more generic way?

		const oldSegment = cache.Segments.findOne(oldSegmentId)
		renamedSegments.set(oldSegmentId, newSegmentId)
		if (oldSegment) {
			cache.Segments.remove(oldSegmentId)
			cache.Segments.insert({
				...oldSegment,
				_id: newSegmentId,
			})
		}

		// Move over those parts to the new segmentId.
		cache.Parts.update((p) => p.segmentId === oldSegmentId, {
			$set: {
				segmentId: newSegmentId,
			},
		})

		cache.Pieces.update((p) => p.startRundownId === cache.RundownId && p.startSegmentId === oldSegmentId, {
			$set: {
				startSegmentId: newSegmentId,
			},
		})
	})

	return renamedSegments
}

export type SegmentEntries = { [segmentExternalId: string]: LocalIngestSegment }
export function compileSegmentEntries(ingestSegments: ReadonlyDeep<Array<LocalIngestSegment>>): SegmentEntries {
	const segmentEntries: SegmentEntries = {}

	for (const ingestSegment of ingestSegments) {
		if (segmentEntries[ingestSegment.externalId]) {
			throw new Meteor.Error(
				500,
				`compileSegmentEntries: Non-unique segment external ID: "${ingestSegment.externalId}"`
			)
		}
		segmentEntries[ingestSegment.externalId] = clone<LocalIngestSegment>(ingestSegment)
	}

	return segmentEntries
}
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
export function diffSegmentEntries(
	oldSegmentEntries: SegmentEntries,
	newSegmentEntries: SegmentEntries,
	oldSegments: Segment[] | null
): DiffSegmentEntries {
	const diff: DiffSegmentEntries = {
		added: {},
		changed: {},
		removed: {},
		unchanged: {},

		onlyRankChanged: {},
		externalIdChanged: {},
	}
	const oldSegmentMap: { [externalId: string]: Segment } | null =
		oldSegments === null ? null : normalizeArray(oldSegments, 'externalId')

	_.each(newSegmentEntries, (newSegmentEntry, segmentExternalId) => {
		const oldSegmentEntry = oldSegmentEntries[segmentExternalId] as IngestSegment | undefined
		let oldSegment: Segment | undefined
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
