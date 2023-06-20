import { TimelineObjGeneric } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { applyToArray, clone, getRandomId } from '@sofie-automation/corelib/dist/lib'
import { TSR } from '@sofie-automation/blueprints-integration'
import { JobContext } from '../jobs'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { CacheForPlayout, getOrderedSegmentsAndPartsFromPlayoutCache, getRundownIDsFromCache } from './cache'
import { logger } from '../logging'
import { getCurrentTime } from '../lib'
import { calculatePartExpectedDurationWithPreroll } from '@sofie-automation/corelib/dist/playout/timings'
import { MongoQuery } from '../db'
import { mongoWhere } from '@sofie-automation/corelib/dist/mongo'
import _ = require('underscore')
import { setNextPart } from './setNext'
import { selectNextPart } from './selectNextPart'

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

		delete p.lastTakeTime
		delete p.startedPlayback
		delete p.rundownsStartedPlayback
		delete p.previousPersistentState
		delete p.trackedAbSessions
		delete p.nextSegmentId

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
		await setNextPart(context, cache, firstPart, false)
	} else {
		await setNextPart(context, cache, null, false)
	}
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
		const rundownIds = getRundownIDsFromCache(cache)
		const partInstanceIdsInCache = cache.PartInstances.findAll(null).map((p) => p._id)

		// Find all the partInstances which are not loaded, but should be reset
		const resetInDb = await context.directCollections.PartInstances.findFetch(
			{
				$and: [
					selector ?? {},
					{
						// Not any which are in the cache, as they have already been done if needed
						_id: { $nin: partInstanceIdsInCache },
						rundownId: { $in: rundownIds },
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
							rundownId: { $in: rundownIds },
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
							rundownId: { $in: rundownIds },
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
		const rundownIds = getRundownIDsFromCache(cache)
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
						rundownId: { $in: rundownIds },
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
							rundownId: { $in: rundownIds },
						},
						transaction
				  )
				: undefined,
			allToRemove.length > 0
				? context.directCollections.PieceInstances.remove(
						{
							partInstanceId: { $in: allToRemove },
							rundownId: { $in: rundownIds },
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
