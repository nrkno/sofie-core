import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { logger } from '../../logging'
import { DBRundown, RundownHoldState, RundownId } from '../../../lib/collections/Rundowns'
import { Part, DBPart } from '../../../lib/collections/Parts'
import {
	getCurrentTime,
	Time,
	clone,
	literal,
	waitForPromise,
	protectString,
	applyToArray,
	getRandomId,
	unprotectString,
} from '../../../lib/lib'
import { TimelineObjGeneric } from '../../../lib/collections/Timeline'
import {
	fetchPiecesThatMayBeActiveForPart,
	getPieceInstancesForPart,
	syncPlayheadInfinitesForNextPartInstance,
} from './infinites'
import { Segment, DBSegment, SegmentId } from '../../../lib/collections/Segments'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { PartInstance, DBPartInstance, PartInstanceId } from '../../../lib/collections/PartInstances'
import { TSR } from '@sofie-automation/blueprints-integration'
import { profiler } from '../profiler'
import { ReadonlyDeep } from 'type-fest'
import { DbCacheReadCollection } from '../../cache/CacheCollection'
import {
	CacheForPlayout,
	getOrderedSegmentsAndPartsFromPlayoutCache,
	getRundownIDsFromCache,
	getSelectedPartInstancesFromCache as getSelectedPartInstancesFromCache2,
} from './cache'
import { Settings } from '../../../lib/Settings'
import { runIngestOperationWithCache, UpdateIngestRundownAction } from '../ingest/lockFunction'

export const LOW_PRIO_DEFER_TIME = 40 // ms

/**
 * Reset the rundownPlaylist (all of the rundowns within the playlist):
 * Remove all dynamically inserted/updated pieces, parts, timings etc..
 */
export function resetRundownPlaylist(cache: CacheForPlayout): void {
	logger.info('resetRundownPlaylist ' + cache.Playlist.doc._id)
	// Remove all dunamically inserted pieces (adlibs etc)
	// const rundownIds = new Set(getRundownIDsFromCache(cache))

	const partInstancesToRemove = new Set(cache.PartInstances.remove((p) => p.rehearsal))
	cache.PieceInstances.remove((p) => partInstancesToRemove.has(p.partInstanceId))

	cache.PartInstances.update((p) => !p.reset, {
		$set: {
			reset: true,
		},
	})
	cache.PieceInstances.update((p) => !p.reset, {
		$set: {
			reset: true,
		},
	})

	cache.Playlist.update({
		$set: {
			previousPartInstanceId: null,
			currentPartInstanceId: null,
			holdState: RundownHoldState.NONE,
		},
		$unset: {
			startedPlayback: 1,
			previousPersistentState: 1,
			trackedAbSessions: 1,
		},
	})

	cache.Rundowns.update(
		{},
		{
			$unset: {
				startedPlayback: 1,
			},
		}
	)

	if (cache.Playlist.doc.activationId) {
		// generate a new activationId
		cache.Playlist.update({
			$set: {
				activationId: getRandomId(),
			},
		})

		// put the first on queue:
		const firstPart = selectNextPart(cache.Playlist.doc, null, getOrderedSegmentsAndPartsFromPlayoutCache(cache))
		setNextPart(cache, firstPart ? firstPart.part : null)
	} else {
		setNextPart(cache, null)
	}
}

export interface SelectNextPartResult {
	part: Part
	index: number
	consumesNextSegmentId?: boolean
}
export interface PartsAndSegments {
	segments: DBSegment[]
	parts: Part[]
}

export function selectNextPart(
	rundownPlaylist: Pick<RundownPlaylist, 'nextSegmentId' | 'loop'>,
	previousPartInstance: PartInstance | null,
	{ parts, segments }: PartsAndSegments,
	ignoreUnplayabale = true
): SelectNextPartResult | undefined {
	const span = profiler.startSpan('selectNextPart')
	/**
	 * Iterates over all the parts and searches for the first one to be playable
	 * @param offset the index from where to start the search
	 * @param condition whether the part will be returned
	 * @param length the maximum index or where to stop the search
	 */
	const findFirstPlayablePart = (
		offset: number,
		condition?: (part: Part) => boolean,
		length?: number
	): SelectNextPartResult | undefined => {
		// Filter to after and find the first playabale
		for (let index = offset; index < (length || parts.length); index++) {
			const part = parts[index]
			if ((!ignoreUnplayabale || part.isPlayable()) && (!condition || condition(part))) {
				return { part, index }
			}
		}
		return undefined
	}

	let searchFromIndex = 0
	if (previousPartInstance) {
		const currentIndex = parts.findIndex((p) => p._id === previousPartInstance.part._id)
		if (currentIndex !== -1) {
			// Start looking at the next part
			searchFromIndex = currentIndex + 1
		} else {
			const segmentStarts = new Map<SegmentId, number>()
			parts.forEach((p, i) => {
				if (!segmentStarts.has(p.segmentId)) {
					segmentStarts.set(p.segmentId, i)
				}
			})

			// Look for other parts in the segment to reference
			const segmentStartIndex = segmentStarts.get(previousPartInstance.segmentId)
			if (segmentStartIndex !== undefined) {
				let nextInSegmentIndex: number | undefined
				for (let i = segmentStartIndex; i < parts.length; i++) {
					const part = parts[i]
					if (part.segmentId !== previousPartInstance.segmentId) break
					if (part._rank <= previousPartInstance.part._rank) {
						nextInSegmentIndex = i + 1
					}
				}

				searchFromIndex = nextInSegmentIndex ?? segmentStartIndex
			} else {
				// If we didn't find the segment in the list of parts, then look for segments after this one.
				const segmentIndex = segments.findIndex((s) => s._id === previousPartInstance.segmentId)
				let followingSegmentStart: number | undefined
				if (segmentIndex !== -1) {
					// Find the first segment with parts that lies after this
					for (let i = segmentIndex + 1; i < segments.length; i++) {
						const segmentStart = segmentStarts.get(segments[i]._id)
						if (segmentStart !== undefined) {
							followingSegmentStart = segmentStart
							break
						}
					}

					// Either there is a segment after, or we are at the end of the rundown
					searchFromIndex = followingSegmentStart ?? parts.length + 1
				} else {
					// Somehow we cannot place the segment, so the start of the playlist is better than nothing
				}
			}
		}
	}

	// Filter to after and find the first playabale
	let nextPart = findFirstPlayablePart(searchFromIndex)

	if (rundownPlaylist.nextSegmentId) {
		// No previous part, or segment has changed
		if (!previousPartInstance || (nextPart && previousPartInstance.segmentId !== nextPart.part.segmentId)) {
			// Find first in segment
			const newSegmentPart = findFirstPlayablePart(0, (part) => part.segmentId === rundownPlaylist.nextSegmentId)
			if (newSegmentPart) {
				// If matched matched, otherwise leave on auto
				nextPart = {
					...newSegmentPart,
					consumesNextSegmentId: true,
				}
			}
		}
	}

	// if playlist should loop, check from 0 to currentPart
	if (rundownPlaylist.loop && !nextPart && previousPartInstance) {
		// Search up until the current part
		nextPart = findFirstPlayablePart(0, undefined, searchFromIndex - 1)
	}

	if (span) span.end()
	return nextPart
}
export function setNextPart(
	cache: CacheForPlayout,
	rawNextPart: Part | DBPartInstance | null,
	setManually?: boolean,
	nextTimeOffset?: number | undefined
) {
	const span = profiler.startSpan('setNextPart')

	const rundownIds = getRundownIDsFromCache(cache)
	const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache2(cache)

	const movingToNewSegment =
		!currentPartInstance || !rawNextPart || rawNextPart.segmentId !== currentPartInstance.segmentId

	const newNextPartInstance = rawNextPart && 'part' in rawNextPart ? rawNextPart : null
	let newNextPart = rawNextPart && 'part' in rawNextPart ? null : rawNextPart

	const nonTakenPartInstances = cache.PartInstances.findFetch({
		rundownId: { $in: rundownIds },
		isTaken: { $ne: true },
	})

	if (newNextPart || newNextPartInstance) {
		if (!cache.Playlist.doc.activationId)
			throw new Meteor.Error(500, `RundownPlaylist "${cache.Playlist.doc._id}" is not active`)

		if ((newNextPart && newNextPart.invalid) || (newNextPartInstance && newNextPartInstance.part.invalid)) {
			throw new Meteor.Error(400, 'Part is marked as invalid, cannot set as next.')
		}
		if (newNextPart && !rundownIds.includes(newNextPart.rundownId)) {
			throw new Meteor.Error(
				409,
				`Part "${newNextPart._id}" of rundown "${newNextPart.rundownId}" not part of RundownPlaylist "${cache.Playlist.doc._id}"`
			)
		} else if (newNextPartInstance && !rundownIds.includes(newNextPartInstance.rundownId)) {
			throw new Meteor.Error(
				409,
				`PartInstance "${newNextPartInstance._id}" of rundown "${newNextPartInstance.rundownId}" not part of RundownPlaylist "${cache.Playlist.doc._id}"`
			)
		}

		const nextPart = newNextPartInstance ? newNextPartInstance.part : newNextPart!

		// create new instance
		let newInstanceId: PartInstanceId
		if (newNextPartInstance) {
			newInstanceId = newNextPartInstance._id
			syncPlayheadInfinitesForNextPartInstance(cache)
		} else if (nextPartInstance && nextPartInstance.part._id === nextPart._id) {
			// Re-use existing
			newInstanceId = nextPartInstance._id
			syncPlayheadInfinitesForNextPartInstance(cache)
		} else {
			// Create new isntance
			newInstanceId = protectString<PartInstanceId>(`${nextPart._id}_${Random.id()}`)
			const newTakeCount = currentPartInstance ? currentPartInstance.takeCount + 1 : 0 // Increment
			cache.PartInstances.insert({
				_id: newInstanceId,
				takeCount: newTakeCount,
				playlistActivationId: cache.Playlist.doc.activationId,
				rundownId: nextPart.rundownId,
				segmentId: nextPart.segmentId,
				part: nextPart,
				rehearsal: !!cache.Playlist.doc.rehearsal,
			})

			const possiblePieces = waitForPromise(fetchPiecesThatMayBeActiveForPart(cache, nextPart))
			const newPieceInstances = getPieceInstancesForPart(
				cache,
				currentPartInstance,
				nextPart,
				possiblePieces,
				newInstanceId,
				false
			)
			for (const pieceInstance of newPieceInstances) {
				cache.PieceInstances.insert(pieceInstance)
			}
		}

		const selectedPartInstanceIds = _.compact([
			newInstanceId,
			cache.Playlist.doc.currentPartInstanceId,
			cache.Playlist.doc.previousPartInstanceId,
		])
		// reset any previous instances of this part
		cache.PartInstances.update(
			{
				_id: { $nin: selectedPartInstanceIds },
				rundownId: nextPart.rundownId,
				'part._id': nextPart._id,
				reset: { $ne: true },
			},
			{
				$set: {
					reset: true,
				},
			}
		)
		cache.PieceInstances.update(
			{
				partInstanceId: { $nin: selectedPartInstanceIds },
				rundownId: nextPart.rundownId,
				'piece.partId': nextPart._id,
				reset: { $ne: true },
			},
			{
				$set: {
					reset: true,
				},
			}
		)

		cache.Playlist.update({
			$set: literal<Partial<RundownPlaylist>>({
				nextPartInstanceId: newInstanceId,
				nextPartManual: !!(setManually || newNextPartInstance?.orphaned),
				nextTimeOffset: nextTimeOffset || null,
			}),
		})
	} else {
		// Set to null

		cache.Playlist.update({
			$set: literal<Partial<RundownPlaylist>>({
				nextPartInstanceId: null,
				nextPartManual: !!setManually,
				nextTimeOffset: null,
			}),
		})
	}

	// Remove any instances which havent been taken
	const instancesIdsToRemove = cache.PartInstances.remove(
		(p) =>
			!p.isTaken &&
			p._id !== cache.Playlist.doc.nextPartInstanceId &&
			p._id !== cache.Playlist.doc.currentPartInstanceId
	)
	cache.PieceInstances.remove((p) => instancesIdsToRemove.includes(p.partInstanceId))

	if (movingToNewSegment && cache.Playlist.doc.nextSegmentId) {
		// TODO - shouldnt this be done on take? this will have a bug where once the segment is set as next, another call to ensure the next is correct will change it
		cache.Playlist.update({
			$unset: {
				nextSegmentId: 1,
			},
		})
		// delete rundownPlaylist.nextSegmentId
	}

	cleanupOrphanedItems(cache)

	if (span) span.end()
}
export function setNextSegment(cache: CacheForPlayout, nextSegment: Segment | null) {
	const span = profiler.startSpan('setNextSegment')
	if (nextSegment) {
		// Just run so that errors will be thrown if something wrong:
		const partsInSegment = cache.Parts.findFetch({ segmentId: nextSegment._id })
		if (!partsInSegment.find((p) => p.isPlayable())) {
			throw new Meteor.Error(400, 'Segment contains no valid parts')
		}

		cache.Playlist.update({
			$set: {
				nextSegmentId: nextSegment._id,
			},
		})
	} else {
		cache.Playlist.update({
			$unset: {
				nextSegmentId: 1,
			},
		})
	}
	if (span) span.end()
}

/**
 * Cleanup any orphaned (deleted) segments and partinstances once they are no longer being played
 * @param cache
 */
function cleanupOrphanedItems(cache: CacheForPlayout) {
	const playlist = cache.Playlist.doc
	const selectedPartInstanceIds = _.compact([playlist.currentPartInstanceId, playlist.nextPartInstanceId])

	const removePartInstanceIds: PartInstanceId[] = []

	// Cleanup any orphaned segments once they are no longer being played
	const segments = cache.Segments.findFetch((s) => s.orphaned === 'deleted')
	const orphanedSegmentIds = new Set(segments.map((s) => s._id))
	const groupedPartInstances = _.groupBy(
		cache.PartInstances.findFetch((p) => orphanedSegmentIds.has(p.segmentId)),
		(p) => p.segmentId
	)
	const removeSegmentsFromRundowns = new Map<RundownId, SegmentId[]>()
	for (const segment of segments) {
		const partInstances = groupedPartInstances[unprotectString(segment._id)]
		const partInstanceIds = new Set(partInstances.map((p) => p._id))

		// Not in current or next. Previous can be reset as it will still be in the db, but not shown in the ui
		if (
			(!playlist.currentPartInstanceId || !partInstanceIds.has(playlist.currentPartInstanceId)) &&
			(!playlist.nextPartInstanceId || !partInstanceIds.has(playlist.nextPartInstanceId))
		) {
			// The segment is finished with. Queue it for attempted removal
			const existing = removeSegmentsFromRundowns.get(segment.rundownId)
			if (existing) {
				existing.push(segment._id)
			} else {
				removeSegmentsFromRundowns.set(segment.rundownId, [segment._id])
			}
		}
	}

	// We need to run this outside of the current lock, and within an ingest lock, so defer to the work queue
	for (const [rundownId, candidateSegmentIds] of removeSegmentsFromRundowns) {
		const rundown = cache.Rundowns.findOne(rundownId)
		if (rundown) {
			Meteor.defer(() => {
				runIngestOperationWithCache(
					'cleanupOrphanedItems:defer',
					rundown.studioId,
					rundown.externalId,
					(ingestRundown) => ingestRundown ?? UpdateIngestRundownAction.DELETE,
					async (ingestCache) => {
						// Find the segments that are still orphaned (in case they have resynced before this executes)
						// We flag them for deletion again, and they will either be kept if they are someone playing, or purged if they are not
						const stillOrphanedSegments = ingestCache.Segments.findFetch(
							(s) => s.orphaned === 'deleted' && candidateSegmentIds.includes(s._id)
						)

						return {
							changedSegmentIds: [],
							removedSegmentIds: stillOrphanedSegments.map((s) => s._id),
							renamedSegments: new Map(),

							removeRundown: false,

							showStyle: undefined,
							blueprint: undefined,
						}
					}
				)
			})
		}
	}

	// Cleanup any orphaned partinstances once they are no longer being played (and the segment isnt orphaned)
	const orphanedInstances = cache.PartInstances.findFetch((p) => p.orphaned === 'deleted' && !p.reset)
	for (const partInstance of orphanedInstances) {
		if (Settings.preserveUnsyncedPlayingSegmentContents && orphanedSegmentIds.has(partInstance.segmentId)) {
			// If the segment is also orphaned, then don't delete it until it is clear
			continue
		}

		if (!selectedPartInstanceIds.includes(partInstance._id)) {
			removePartInstanceIds.push(partInstance._id)
		}
	}

	// Cleanup any instances from above
	if (removePartInstanceIds.length > 0) {
		cache.PartInstances.update({ _id: { $in: removePartInstanceIds } }, { $set: { reset: true } })
		cache.PieceInstances.update({ partInstanceId: { $in: removePartInstanceIds } }, { $set: { reset: true } })
	}
}

export function onPartHasStoppedPlaying(cache: CacheForPlayout, partInstance: PartInstance, stoppedPlayingTime: Time) {
	if (partInstance.timings?.startedPlayback && partInstance.timings.startedPlayback > 0) {
		cache.PartInstances.update(partInstance._id, {
			$set: {
				'timings.duration': stoppedPlayingTime - partInstance.timings.startedPlayback,
			},
		})
	} else {
		// logger.warn(`Part "${part._id}" has never started playback on rundown "${rundownId}".`)
	}
}

export function substituteObjectIds(
	rawEnable: TSR.Timeline.TimelineEnable | TSR.Timeline.TimelineEnable[],
	idMap: { [oldId: string]: string | undefined }
) {
	const replaceIds = (str: string) => {
		return str.replace(/#([a-zA-Z0-9_]+)/g, (m) => {
			const id = m.substr(1, m.length - 1)
			return `#${idMap[id] || id}`
		})
	}

	const enable = clone<TSR.Timeline.TimelineEnable | TSR.Timeline.TimelineEnable[]>(rawEnable)
	applyToArray(enable, (enable0) => {
		for (const key of _.keys(enable0)) {
			if (typeof enable0[key] === 'string') {
				enable0[key] = replaceIds(enable0[key])
			}
		}
	})

	return enable
}
export function prefixAllObjectIds<T extends TimelineObjGeneric>(
	objList: T[],
	prefix: string,
	ignoreOriginal?: boolean
): T[] {
	const getUpdatePrefixedId = (o: T) => {
		let id = o.id
		if (!ignoreOriginal) {
			if (!o.originalId) {
				o.originalId = o.id
			}
			id = o.originalId
		}
		return prefix + id
	}

	const idMap: { [oldId: string]: string | undefined } = {}
	_.each(objList, (o) => {
		idMap[o.id] = getUpdatePrefixedId(o)
	})

	return objList.map((rawObj) => {
		const obj = clone(rawObj)

		obj.id = getUpdatePrefixedId(obj)
		obj.enable = substituteObjectIds(obj.enable, idMap)

		if (typeof obj.inGroup === 'string') {
			obj.inGroup = idMap[obj.inGroup] || obj.inGroup
		}

		return obj
	})
}

/**
 * time in ms before an autotake when we don't accept takes/updates
 */
const AUTOTAKE_UPDATE_DEBOUNCE = 5000
const AUTOTAKE_TAKE_DEBOUNCE = 1000

export function isTooCloseToAutonext(currentPartInstance: ReadonlyDeep<PartInstance> | undefined, isTake?: boolean) {
	if (!currentPartInstance || !currentPartInstance.part.autoNext) return false

	const debounce = isTake ? AUTOTAKE_TAKE_DEBOUNCE : AUTOTAKE_UPDATE_DEBOUNCE

	const start = currentPartInstance.timings?.startedPlayback
	const offset = currentPartInstance.timings?.playOffset
	if (start !== undefined && offset !== undefined && currentPartInstance.part.expectedDuration) {
		// date.now - start = playback duration, duration + offset gives position in part
		const playbackDuration = getCurrentTime() - start + offset

		// If there is an auto next planned
		if (Math.abs(currentPartInstance.part.expectedDuration - playbackDuration) < debounce) {
			return true
		}
	}

	return false
}

export function getRundownsSegmentsAndPartsFromCache(
	partsCache: DbCacheReadCollection<Part, DBPart>,
	segmentsCache: DbCacheReadCollection<Segment, DBSegment>,
	rundowns: Array<ReadonlyDeep<DBRundown>>
): { segments: Segment[]; parts: Part[] } {
	const segments = RundownPlaylist._sortSegments(
		segmentsCache.findFetch(
			{},
			{
				sort: {
					rundownId: 1,
					_rank: 1,
				},
			}
		),
		rundowns
	)

	const parts = RundownPlaylist._sortPartsInner(
		partsCache.findFetch(
			{},
			{
				sort: {
					rundownId: 1,
					_rank: 1,
				},
			}
		),
		segments
	)

	return {
		segments: segments,
		parts: parts,
	}
}
