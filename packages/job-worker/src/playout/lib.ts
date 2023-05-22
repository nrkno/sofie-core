import { TimelineObjGeneric } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { applyToArray, clone, getRandomId } from '@sofie-automation/corelib/dist/lib'
import { TSR } from '@sofie-automation/blueprints-integration'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart, isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { JobContext } from '../jobs'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBRundownPlaylist, RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PartInstanceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DbCacheReadCollection } from '../cache/CacheCollection'
import { ReadonlyDeep } from 'type-fest'
import { sortPartsInSortedSegments, sortSegmentsInRundowns } from '@sofie-automation/corelib/dist/playout/playlist'
import { CacheForPlayout, getOrderedSegmentsAndPartsFromPlayoutCache } from './cache'
import { logger } from '../logging'
import { getCurrentTime } from '../lib'
import { calculatePartExpectedDurationWithPreroll } from '@sofie-automation/corelib/dist/playout/timings'
import { MongoQuery } from '../db'
import { mongoWhere } from '@sofie-automation/corelib/dist/mongo'
import _ = require('underscore')
import { setNextPart } from './setNext'

/**
 * Reset the rundownPlaylist (all of the rundowns within the playlist):
 * Remove all dynamically inserted/updated pieces, parts, timings etc..
 */
export async function resetRundownPlaylist(context: JobContext, cache: CacheForPlayout): Promise<void> {
	logger.info('resetRundownPlaylist ' + cache.Playlist.doc._id)
	// Remove all dunamically inserted pieces (adlibs etc)
	// const rundownIds = new Set(getRundownIDsFromCache(cache))

	removePartInstancesWithPieceInstances(context, cache, { rehearsal: true })
	resetPartInstancesWithPieceInstances(context, cache)

	cache.Playlist.update((p) => {
		p.previousPartInfo = null
		p.currentPartInfo = null
		p.holdState = RundownHoldState.NONE
		p.resetTime = getCurrentTime()

		delete p.startedPlayback
		delete p.rundownsStartedPlayback
		delete p.previousPersistentState
		delete p.trackedAbSessions

		return p
	})

	if (cache.Playlist.doc.activationId) {
		// generate a new activationId
		cache.Playlist.update((p) => {
			p.activationId = getRandomId()
			return p
		})

		// put the first on queue:
		const firstPart = selectNextPart(
			context,
			cache.Playlist.doc,
			null,
			null,
			getOrderedSegmentsAndPartsFromPlayoutCache(cache)
		)
		await setNextPart(context, cache, firstPart)
	} else {
		await setNextPart(context, cache, null)
	}
}

export interface SelectNextPartResult {
	part: DBPart
	index: number
	consumesNextSegmentId?: boolean
}
export interface PartsAndSegments {
	segments: DBSegment[]
	parts: DBPart[]
}

export function selectNextPart(
	context: JobContext,
	rundownPlaylist: Pick<DBRundownPlaylist, 'nextSegmentId' | 'loop'>,
	previousPartInstance: DBPartInstance | null,
	currentlySelectedPartInstance: DBPartInstance | null,
	{ parts: parts0, segments }: PartsAndSegments,
	ignoreUnplayabale = true
): SelectNextPartResult | null {
	const span = context.startSpan('selectNextPart')

	// In the parts array, insert currentlySelectedPartInstance over its part, as it is already nexted, so wont change unless necessary
	const parts = currentlySelectedPartInstance
		? parts0.map((p) => (p._id === currentlySelectedPartInstance.part._id ? currentlySelectedPartInstance.part : p))
		: parts0

	/**
	 * Iterates over all the parts and searches for the first one to be playable
	 * @param offset the index from where to start the search
	 * @param condition whether the part will be returned
	 * @param length the maximum index or where to stop the search
	 */
	const findFirstPlayablePart = (
		offset: number,
		condition?: (part: DBPart) => boolean,
		length?: number
	): SelectNextPartResult | undefined => {
		// Filter to after and find the first playabale
		for (let index = offset; index < (length || parts.length); index++) {
			const part = parts[index]
			if ((!ignoreUnplayabale || isPartPlayable(part)) && (!condition || condition(part))) {
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
	return nextPart ?? null
}

/**
 * Reset selected or all partInstances with their pieceInstances
 * @param cache
 * @param selector if not provided, all partInstances will be reset
 */
export function resetPartInstancesWithPieceInstances(
	context: JobContext,
	cache: CacheForPlayout,
	selector?: MongoQuery<DBPartInstance>
): void {
	const partInstancesToReset = cache.PartInstances.updateAll((p) => {
		if (!p.reset && (!selector || mongoWhere(p, selector))) {
			p.reset = true
			return p
		} else {
			return false
		}
	})

	// Reset any in the cache now
	if (partInstancesToReset.length) {
		cache.PieceInstances.updateAll((p) => {
			if (!p.reset && partInstancesToReset.includes(p.partInstanceId)) {
				p.reset = true
				return p
			} else {
				return false
			}
		})
	}

	// Defer ones which arent loaded
	cache.deferDuringSaveTransaction(async (transaction, cache) => {
		const partInstanceIdsInCache = cache.PartInstances.findAll(null).map((p) => p._id)

		// Find all the partInstances which are not loaded, but should be reset
		const resetInDb = await context.directCollections.PartInstances.findFetch(
			{
				$and: [
					selector ?? {},
					{
						// Not any which are in the cache, as they have already been done if needed
						_id: { $nin: partInstanceIdsInCache },
						reset: { $ne: true },
					},
				],
			},
			{ projection: { _id: 1 } },
			transaction
		).then((ps) => ps.map((p) => p._id))

		// Do the reset
		const allToReset = [...resetInDb, ...partInstancesToReset]
		await Promise.all([
			resetInDb.length
				? context.directCollections.PartInstances.update(
						{
							_id: { $in: resetInDb },
							reset: { $ne: true },
						},
						{
							$set: {
								reset: true,
							},
						},
						transaction
				  )
				: undefined,
			allToReset.length
				? context.directCollections.PieceInstances.update(
						{
							partInstanceId: { $in: allToReset },
							reset: { $ne: true },
						},
						{
							$set: {
								reset: true,
							},
						},
						transaction
				  )
				: undefined,
		])
	})
}

/**
 * Remove selected partInstances with their pieceInstances
 */
function removePartInstancesWithPieceInstances(
	context: JobContext,
	cache: CacheForPlayout,
	selector: MongoQuery<DBPartInstance>
): void {
	const partInstancesToRemove = cache.PartInstances.remove((p) => mongoWhere(p, selector))

	// Reset any in the cache now
	if (partInstancesToRemove.length) {
		cache.PieceInstances.remove((p) => partInstancesToRemove.includes(p.partInstanceId))
	}

	// Defer ones which arent loaded
	cache.deferDuringSaveTransaction(async (transaction, cache) => {
		// We need to keep any for PartInstances which are still existent in the cache (as they werent removed)
		const partInstanceIdsInCache = cache.PartInstances.findAll(null).map((p) => p._id)

		// Find all the partInstances which are not loaded, but should be removed
		const removeFromDb = await context.directCollections.PartInstances.findFetch(
			{
				$and: [
					selector,
					{
						// Not any which are in the cache, as they have already been done if needed
						_id: { $nin: partInstanceIdsInCache },
					},
				],
			},
			{ projection: { _id: 1 } },
			transaction
		).then((ps) => ps.map((p) => p._id))

		// Do the remove
		const allToRemove = [...removeFromDb, ...partInstancesToRemove]
		await Promise.all([
			removeFromDb.length > 0
				? context.directCollections.PartInstances.remove(
						{
							_id: { $in: removeFromDb },
						},
						transaction
				  )
				: undefined,
			allToRemove.length > 0
				? context.directCollections.PieceInstances.remove(
						{
							partInstanceId: { $in: allToRemove },
						},
						transaction
				  )
				: undefined,
		])
	})
}

export function substituteObjectIds(
	rawEnable: TSR.Timeline.TimelineEnable | TSR.Timeline.TimelineEnable[],
	idMap: { [oldId: string]: string | undefined }
): TSR.Timeline.TimelineEnable | TSR.Timeline.TimelineEnable[] {
	const replaceIds = (str: string) => {
		return str.replace(/#([a-zA-Z0-9_]+)/g, (m) => {
			const id = m.substr(1, m.length - 1)
			return `#${idMap[id] || id}`
		})
	}

	const enable = clone<TSR.Timeline.TimelineEnable | TSR.Timeline.TimelineEnable[]>(rawEnable)
	applyToArray(enable, (enable0) => {
		for (const key0 in enable0) {
			const key = key0 as keyof TSR.Timeline.TimelineEnable
			const oldVal = enable0[key]
			if (typeof oldVal === 'string') {
				enable0[key] = replaceIds(oldVal)
			}
		}
	})

	return enable
}
export function prefixSingleObjectId<T extends TimelineObjGeneric>(
	obj: T,
	prefix: string,
	ignoreOriginal?: never
): string {
	let id = obj.id
	if (!ignoreOriginal) {
		if (!obj.originalId) {
			obj.originalId = obj.id
		}
		id = obj.originalId
	}
	return prefix + id
}
export function prefixAllObjectIds<T extends TimelineObjGeneric>(
	objList: T[],
	prefix: string,
	ignoreOriginal?: never
): T[] {
	const idMap: { [oldId: string]: string | undefined } = {}
	_.each(objList, (o) => {
		idMap[o.id] = prefixSingleObjectId(o, prefix, ignoreOriginal)
	})

	return objList.map((rawObj) => {
		const obj = clone(rawObj)

		obj.id = prefixSingleObjectId(obj, prefix, ignoreOriginal)
		obj.enable = substituteObjectIds(obj.enable, idMap)

		if (typeof obj.inGroup === 'string') {
			obj.inGroup = idMap[obj.inGroup] || obj.inGroup
		}

		// make sure any keyframes are unique
		if (obj.keyframes) {
			for (const kf of obj.keyframes) {
				kf.id = `${kf.id}_${obj.id}`
			}
		}

		return obj
	})
}

/**
 * time in ms before an autotake when we don't accept takes/updates
 */
const AUTOTAKE_UPDATE_DEBOUNCE = 5000
const AUTOTAKE_TAKE_DEBOUNCE = 1000

export function isTooCloseToAutonext(
	currentPartInstance: ReadonlyDeep<DBPartInstance> | undefined,
	isTake?: boolean
): boolean {
	if (!currentPartInstance || !currentPartInstance.part.autoNext) return false

	const debounce = isTake ? AUTOTAKE_TAKE_DEBOUNCE : AUTOTAKE_UPDATE_DEBOUNCE

	const start = currentPartInstance.timings?.plannedStartedPlayback
	if (start !== undefined && currentPartInstance.part.expectedDuration) {
		// date.now - start = playback duration, duration + offset gives position in part
		const playbackDuration = getCurrentTime() - start

		// If there is an auto next planned
		if (Math.abs(currentPartInstance.part.expectedDuration - playbackDuration) < debounce) {
			return true
		}
	}

	return false
}

export function getRundownsSegmentsAndPartsFromCache(
	partsCache: DbCacheReadCollection<DBPart>,
	segmentsCache: DbCacheReadCollection<DBSegment>,
	playlist: Pick<ReadonlyDeep<DBRundownPlaylist>, 'rundownIdsInOrder'>
): { segments: DBSegment[]; parts: DBPart[] } {
	const segments = sortSegmentsInRundowns(
		segmentsCache.findAll(null, {
			sort: {
				rundownId: 1,
				_rank: 1,
			},
		}),
		playlist
	)

	const parts = sortPartsInSortedSegments(
		partsCache.findAll(null, {
			sort: {
				rundownId: 1,
				_rank: 1,
			},
		}),
		segments
	)

	return {
		segments: segments,
		parts: parts,
	}
}

/**
 * Update the expectedDurationWithPreroll on the specified PartInstance.
 * The value is used by the UI to approximate the duration of a PartInstance as it will be played out
 */
export function updateExpectedDurationWithPrerollForPartInstance(
	cache: CacheForPlayout,
	partInstanceId: PartInstanceId
): void {
	const nextPartInstance = cache.PartInstances.findOne(partInstanceId)
	if (nextPartInstance) {
		const pieceInstances = cache.PieceInstances.findAll((p) => p.partInstanceId === nextPartInstance._id)

		// Update expectedDurationWithPreroll of the next part instance, as it may have changed and is used by the ui until it is taken
		const expectedDurationWithPreroll = calculatePartExpectedDurationWithPreroll(
			nextPartInstance.part,
			pieceInstances.map((p) => p.piece)
		)

		cache.PartInstances.updateOne(nextPartInstance._id, (doc) => {
			doc.part.expectedDurationWithPreroll = expectedDurationWithPreroll
			return doc
		})
	}
}
