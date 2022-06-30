import { TimelineObjGeneric } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { applyToArray, assertNever, clone, getRandomId, literal } from '@sofie-automation/corelib/dist/lib'
import { Time, TSR } from '@sofie-automation/blueprints-integration'
import _ = require('underscore')
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart, isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { JobContext } from '../jobs'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBRundownPlaylist, RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PartInstanceId, RundownId, SegmentId, SegmentPlayoutId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DbCacheReadCollection } from '../cache/CacheCollection'
import { ReadonlyDeep } from 'type-fest'
import { sortPartsInSortedSegments, sortSegmentsInRundowns } from '@sofie-automation/corelib/dist/playout/playlist'
import {
	CacheForPlayout,
	getOrderedSegmentsAndPartsFromPlayoutCache,
	getRundownIDsFromCache,
	getSelectedPartInstancesFromCache,
} from './cache'
import {
	fetchPiecesThatMayBeActiveForPart,
	getPieceInstancesForPart,
	syncPlayheadInfinitesForNextPartInstance,
} from './infinites'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { PRESERVE_UNSYNCED_PLAYING_SEGMENT_CONTENTS } from '@sofie-automation/shared-lib/dist/core/constants'
import { logger } from '../logging'
import { getCurrentTime } from '../lib'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import { calculatePartExpectedDurationWithPreroll } from '@sofie-automation/corelib/dist/playout/timings'
import { MongoQuery } from '../db'

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

	cache.Playlist.update({
		$set: {
			previousPartInstanceId: null,
			currentPartInstanceId: null,
			holdState: RundownHoldState.NONE,
			resetTime: getCurrentTime(),
		},
		$unset: {
			startedPlayback: 1,
			rundownsStartedPlayback: 1,
			previousPersistentState: 1,
			trackedAbSessions: 1,
		},
	})

	if (cache.Playlist.doc.activationId) {
		// generate a new activationId
		cache.Playlist.update({
			$set: {
				activationId: getRandomId(),
			},
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

type ParsedNextPart =
	| {
			type: 'part'
			part: DBPart
			consumesNextSegmentId: boolean | undefined
	  }
	| {
			type: 'partinstance'
			instance: DBPartInstance
	  }

export async function setNextPart(
	context: JobContext,
	cache: CacheForPlayout,
	rawNextPart: Omit<SelectNextPartResult, 'index'> | DBPartInstance | null,
	setManually?: boolean,
	nextTimeOffset?: number | undefined
): Promise<void> {
	const span = context.startSpan('setNextPart')

	const rundownIds = getRundownIDsFromCache(cache)
	const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache)

	if (rawNextPart) {
		if (!cache.Playlist.doc.activationId)
			throw new Error(`RundownPlaylist "${cache.Playlist.doc._id}" is not active`)

		let nextPartInfo: ParsedNextPart
		if ('playlistActivationId' in rawNextPart) {
			nextPartInfo = {
				type: 'partinstance',
				instance: rawNextPart,
			}
		} else {
			nextPartInfo = {
				type: 'part',
				part: rawNextPart.part,
				consumesNextSegmentId: rawNextPart.consumesNextSegmentId,
			}
		}

		if (
			(nextPartInfo.type === 'part' && nextPartInfo.part.invalid) ||
			(nextPartInfo.type === 'partinstance' && nextPartInfo.instance.part.invalid)
		) {
			throw new Error('Part is marked as invalid, cannot set as next.')
		}

		switch (nextPartInfo.type) {
			case 'part':
				if (!rundownIds.includes(nextPartInfo.part.rundownId)) {
					throw new Error(
						`Part "${nextPartInfo.part._id}" of rundown "${nextPartInfo.part.rundownId}" not part of RundownPlaylist "${cache.Playlist.doc._id}"`
					)
				}
				break
			case 'partinstance':
				if (!rundownIds.includes(nextPartInfo.instance.rundownId)) {
					throw new Error(
						`PartInstance "${nextPartInfo.instance._id}" of rundown "${nextPartInfo.instance.rundownId}" not part of RundownPlaylist "${cache.Playlist.doc._id}"`
					)
				}
				break
			default:
				assertNever(nextPartInfo)
				throw new Error('Unhandled ParsedNextPart in setNextPart')
		}

		const nextPart = nextPartInfo.type === 'partinstance' ? nextPartInfo.instance.part : nextPartInfo.part

		// create new instance
		let newInstanceId: PartInstanceId
		if (nextPartInfo.type === 'partinstance') {
			newInstanceId = nextPartInfo.instance._id
			cache.PartInstances.update(newInstanceId, {
				$unset: {
					consumesNextSegmentId: 1,
				},
			})
			await syncPlayheadInfinitesForNextPartInstance(context, cache)
		} else if (nextPartInstance && nextPartInstance.part._id === nextPart._id) {
			// Re-use existing
			newInstanceId = nextPartInstance._id
			cache.PartInstances.update(newInstanceId, {
				$set: {
					consumesNextSegmentId: nextPartInfo.consumesNextSegmentId ?? false,
				},
			})
			await syncPlayheadInfinitesForNextPartInstance(context, cache)
		} else {
			// Create new isntance
			newInstanceId = protectString<PartInstanceId>(`${nextPart._id}_${getRandomId()}`)
			const newTakeCount = currentPartInstance ? currentPartInstance.takeCount + 1 : 0 // Increment
			const segmentPlayoutId: SegmentPlayoutId =
				currentPartInstance && nextPart.segmentId === currentPartInstance.segmentId
					? currentPartInstance.segmentPlayoutId
					: getRandomId()

			cache.PartInstances.insert({
				_id: newInstanceId,
				takeCount: newTakeCount,
				playlistActivationId: cache.Playlist.doc.activationId,
				rundownId: nextPart.rundownId,
				segmentId: nextPart.segmentId,
				segmentPlayoutId,
				part: nextPart,
				rehearsal: !!cache.Playlist.doc.rehearsal,
				consumesNextSegmentId: nextPartInfo.consumesNextSegmentId,
			})

			const rundown = cache.Rundowns.findOne(nextPart.rundownId)

			if (!rundown) {
				throw new Error(`Could not find rundown ${nextPart.rundownId}`)
			}

			const possiblePieces = await fetchPiecesThatMayBeActiveForPart(context, cache, undefined, nextPart)
			const newPieceInstances = getPieceInstancesForPart(
				context,
				cache,
				currentPartInstance,
				rundown,
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
		resetPartInstancesWithPieceInstances(context, cache, {
			_id: { $nin: selectedPartInstanceIds },
			rundownId: nextPart.rundownId,
			'part._id': nextPart._id,
		})

		const nextPartInstanceTmp = nextPartInfo.type === 'partinstance' ? nextPartInfo.instance : null
		cache.Playlist.update({
			$set: literal<Partial<DBRundownPlaylist>>({
				nextPartInstanceId: newInstanceId,
				nextPartManual: !!(setManually || nextPartInstanceTmp?.orphaned),
				nextTimeOffset: nextTimeOffset || null,
			}),
		})
	} else {
		// Set to null

		cache.Playlist.update({
			$set: literal<Partial<DBRundownPlaylist>>({
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

	{
		const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache)
		// When entering a segment, or moving backwards in a segment, reset any partInstances in that window
		// In theory the new segment should already be reset, as we do that upon leaving, but it wont be if jumping to earlier in the same segment or maybe if the rundown wasnt reset
		if (nextPartInstance) {
			const resetPartInstanceIds = new Set<PartInstanceId>()
			if (currentPartInstance) {
				// Always clean the current segment, anything after the current part (except the next part)
				const trailingInOldSegment = cache.PartInstances.findFetch(
					(p) =>
						!p.reset &&
						p._id !== currentPartInstance._id &&
						p._id !== nextPartInstance._id &&
						p.segmentId === currentPartInstance.segmentId &&
						p.part._rank > currentPartInstance.part._rank
				)

				for (const part of trailingInOldSegment) {
					resetPartInstanceIds.add(part._id)
				}
			}

			if (
				!currentPartInstance ||
				nextPartInstance.segmentId !== currentPartInstance.segmentId ||
				(nextPartInstance.segmentId === currentPartInstance.segmentId &&
					nextPartInstance.part._rank < currentPartInstance.part._rank)
			) {
				// clean the whole segment if new, or jumping backwards
				const newSegmentParts = cache.PartInstances.findFetch(
					(p) =>
						!p.reset &&
						p._id !== nextPartInstance._id &&
						p._id !== currentPartInstance?._id &&
						p.segmentId === nextPartInstance.segmentId
				)
				for (const part of newSegmentParts) {
					resetPartInstanceIds.add(part._id)
				}
			}

			if (resetPartInstanceIds.size > 0) {
				resetPartInstancesWithPieceInstances(context, cache, {
					_id: { $in: Array.from(resetPartInstanceIds) },
				})
			}
		}
	}

	await cleanupOrphanedItems(context, cache)

	if (span) span.end()
}

export function setNextSegment(context: JobContext, cache: CacheForPlayout, nextSegment: DBSegment | null): void {
	const span = context.startSpan('setNextSegment')
	if (nextSegment) {
		// Just run so that errors will be thrown if something wrong:
		const partsInSegment = cache.Parts.findFetch({ segmentId: nextSegment._id })
		if (!partsInSegment.find((p) => isPartPlayable(p))) {
			throw new Error('Segment contains no valid parts')
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
async function cleanupOrphanedItems(context: JobContext, cache: CacheForPlayout) {
	const playlist = cache.Playlist.doc

	const selectedPartInstancesSegmentIds = new Set<SegmentId>()
	const selectedPartInstances = getSelectedPartInstancesFromCache(cache)
	if (selectedPartInstances.currentPartInstance)
		selectedPartInstancesSegmentIds.add(selectedPartInstances.currentPartInstance.segmentId)
	if (selectedPartInstances.nextPartInstance)
		selectedPartInstancesSegmentIds.add(selectedPartInstances.nextPartInstance.segmentId)

	// Cleanup any orphaned segments once they are no longer being played. This also cleans up any adlib-parts, that have been marked as deleted as a deferred cleanup operation
	const segments = cache.Segments.findFetch((s) => !!s.orphaned)
	const orphanedSegmentIds = new Set(segments.map((s) => s._id))

	const alterSegmentsFromRundowns = new Map<RundownId, { deleted: SegmentId[]; hidden: SegmentId[] }>()
	for (const segment of segments) {
		// If the segment is orphaned and not the segment for the next or current partinstance
		if (!selectedPartInstancesSegmentIds.has(segment._id)) {
			let rundownSegments = alterSegmentsFromRundowns.get(segment.rundownId)
			if (!rundownSegments) {
				rundownSegments = { deleted: [], hidden: [] }
				alterSegmentsFromRundowns.set(segment.rundownId, rundownSegments)
			}
			// The segment is finished with. Queue it for attempted removal or reingest
			switch (segment.orphaned) {
				case SegmentOrphanedReason.DELETED: {
					rundownSegments.deleted.push(segment._id)
					break
				}
				case SegmentOrphanedReason.HIDDEN: {
					rundownSegments.hidden.push(segment._id)
					break
				}
			}
		}
	}

	// We need to run this outside of the current lock, and within an ingest lock, so defer to the work queue
	for (const [rundownId, candidateSegmentIds] of alterSegmentsFromRundowns) {
		const rundown = cache.Rundowns.findOne(rundownId)
		if (rundown?.restoredFromSnapshotId) {
			// This is not valid as the rundownId won't match the externalId, so ingest will fail
			// For now do nothing
		} else if (rundown) {
			await context.queueIngestJob(IngestJobs.RemoveOrphanedSegments, {
				rundownExternalId: rundown.externalId,
				peripheralDeviceId: null,
				orphanedHiddenSegmentIds: candidateSegmentIds.hidden,
				orphanedDeletedSegmentIds: candidateSegmentIds.deleted,
			})
		}
	}

	const removePartInstanceIds: PartInstanceId[] = []
	// Cleanup any orphaned partinstances once they are no longer being played (and the segment isnt orphaned)
	const orphanedInstances = cache.PartInstances.findFetch((p) => p.orphaned === 'deleted' && !p.reset)
	for (const partInstance of orphanedInstances) {
		if (PRESERVE_UNSYNCED_PLAYING_SEGMENT_CONTENTS && orphanedSegmentIds.has(partInstance.segmentId)) {
			// If the segment is also orphaned, then don't delete it until it is clear
			continue
		}

		if (partInstance._id !== playlist.currentPartInstanceId && partInstance._id !== playlist.nextPartInstanceId) {
			removePartInstanceIds.push(partInstance._id)
		}
	}

	// Cleanup any instances from above
	if (removePartInstanceIds.length > 0) {
		resetPartInstancesWithPieceInstances(context, cache, { _id: { $in: removePartInstanceIds } })
	}
}

/**
 * Remove selected partInstances with their pieceInstances
 */
function removePartInstancesWithPieceInstances(
	context: JobContext,
	cache: CacheForPlayout,
	selector: MongoQuery<DBPartInstance>
): void {
	const partInstancesToRemove = cache.PartInstances.remove(selector)

	// Reset any in the cache now
	if (partInstancesToRemove.length) {
		cache.PieceInstances.remove({
			partInstanceId: { $in: partInstancesToRemove },
		})
	}

	// Defer ones which arent loaded
	cache.deferAfterSave(async (cache) => {
		// We need to keep any for PartInstances which are still existent in the cache (as they werent removed)
		const partInstanceIdsInCache = cache.PartInstances.findFetch({}).map((p) => p._id)

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
			{ projection: { _id: 1 } }
		).then((ps) => ps.map((p) => p._id))

		// Do the remove
		const allToRemove = [...removeFromDb, ...partInstancesToRemove]
		await Promise.all([
			removeFromDb.length > 0
				? context.directCollections.PartInstances.remove({
						_id: { $in: removeFromDb },
				  })
				: undefined,
			allToRemove.length > 0
				? context.directCollections.PieceInstances.remove({
						partInstanceId: { $in: allToRemove },
				  })
				: undefined,
		])
	})
}

/**
 * Reset selected or all partInstances with their pieceInstances
 * @param cache
 * @param selector if not provided, all partInstances will be reset
 */
function resetPartInstancesWithPieceInstances(
	context: JobContext,
	cache: CacheForPlayout,
	selector?: MongoQuery<DBPartInstance>
) {
	const partInstancesToReset = cache.PartInstances.update(
		selector
			? {
					...selector,
					reset: { $ne: true },
			  }
			: (p) => !p.reset,
		{
			$set: {
				reset: true,
			},
		}
	)

	// Reset any in the cache now
	if (partInstancesToReset.length) {
		cache.PieceInstances.update(
			{
				partInstanceId: { $in: partInstancesToReset },
				reset: { $ne: true },
			},
			{
				$set: {
					reset: true,
				},
			}
		)
	}

	// Defer ones which arent loaded
	cache.deferAfterSave(async (cache) => {
		const partInstanceIdsInCache = cache.PartInstances.findFetch({}).map((p) => p._id)

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
			{ projection: { _id: 1 } }
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
						}
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
						}
				  )
				: undefined,
		])
	})
}

export function onPartHasStoppedPlaying(
	cache: CacheForPlayout,
	partInstance: DBPartInstance,
	stoppedPlayingTime: Time
): void {
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
	partsCache: DbCacheReadCollection<DBPart>,
	segmentsCache: DbCacheReadCollection<DBSegment>,
	playlist: Pick<ReadonlyDeep<DBRundownPlaylist>, 'rundownIdsInOrder'>
): { segments: DBSegment[]; parts: DBPart[] } {
	const segments = sortSegmentsInRundowns(
		segmentsCache.findFetch(
			{},
			{
				sort: {
					rundownId: 1,
					_rank: 1,
				},
			}
		),
		playlist
	)

	const parts = sortPartsInSortedSegments(
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
		const pieceInstances = cache.PieceInstances.findFetch({ partInstanceId: nextPartInstance._id })

		// Update expectedDurationWithPreroll of the next part instance, as it may have changed and is used by the ui until it is taken
		const expectedDurationWithPreroll = calculatePartExpectedDurationWithPreroll(
			nextPartInstance.part,
			pieceInstances.map((p) => p.piece)
		)

		cache.PartInstances.update(nextPartInstance._id, (doc) => {
			doc.part.expectedDurationWithPreroll = expectedDurationWithPreroll
			return doc
		})
	}
}
