import { TimelineObjGeneric } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { applyToArray, clone } from '@sofie-automation/corelib/dist/lib'
import { TSR } from '@sofie-automation/blueprints-integration'
import { JobContext } from '../jobs'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { PlayoutModel } from './model/PlayoutModel'
import { logger } from '../logging'
import { getCurrentTime } from '../lib'
import { MongoQuery } from '../db'
import { mongoWhere } from '@sofie-automation/corelib/dist/mongo'
import _ = require('underscore')
import { setNextPart } from './setNext'
import { selectNextPart } from './selectNextPart'

/**
 * Reset the rundownPlaylist (all of the rundowns within the playlist):
 * Remove all dynamically inserted/updated pieces, parts, timings etc..
 */
export async function resetRundownPlaylist(context: JobContext, cache: PlayoutModel): Promise<void> {
	logger.info('resetRundownPlaylist ' + cache.Playlist._id)
	// Remove all dunamically inserted pieces (adlibs etc)
	// const rundownIds = new Set((cache.getRundownIds()))

	removePartInstancesWithPieceInstances(context, cache, { rehearsal: true })
	resetPartInstancesWithPieceInstances(context, cache)

	// Remove the scratchpad
	for (const rundown of cache.Rundowns) {
		rundown.removeScratchpadSegment()
	}

	cache.resetPlaylist(!!cache.Playlist.activationId)

	if (cache.Playlist.activationId) {
		// put the first on queue:
		const firstPart = selectNextPart(
			context,
			cache.Playlist,
			null,
			null,
			cache.getAllOrderedSegments(),
			cache.getAllOrderedParts()
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
	cache: PlayoutModel,
	selector?: MongoQuery<DBPartInstance>
): void {
	const partInstanceIdsToReset: PartInstanceId[] = []
	for (const partInstance of cache.LoadedPartInstances) {
		if (!partInstance.PartInstance.reset && (!selector || mongoWhere(partInstance.PartInstance, selector))) {
			partInstance.markAsReset()
			partInstanceIdsToReset.push(partInstance.PartInstance._id)
		}
	}

	// Defer ones which arent loaded
	cache.deferAfterSave(async (cache) => {
		const rundownIds = cache.getRundownIds()
		const partInstanceIdsInCache = cache.LoadedPartInstances.map((p) => p.PartInstance._id)

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
			{ projection: { _id: 1 } }
		).then((ps) => ps.map((p) => p._id))

		// Do the reset
		const allToReset = [...resetInDb, ...partInstanceIdsToReset]
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
						}
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
						}
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
	cache: PlayoutModel,
	selector: MongoQuery<DBPartInstance>
): void {
	const partInstancesToRemove: PartInstanceId[] = []
	for (const partInstance of cache.OlderPartInstances) {
		if (mongoWhere(partInstance.PartInstance, selector)) {
			cache.removePartInstance(partInstance.PartInstance._id)
		}
	}

	// Defer ones which arent loaded
	cache.deferAfterSave(async (cache) => {
		const rundownIds = cache.getRundownIds()
		// We need to keep any for PartInstances which are still existent in the cache (as they werent removed)
		const partInstanceIdsInCache = cache.LoadedPartInstances.map((p) => p.PartInstance._id)

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
			{ projection: { _id: 1 } }
		).then((ps) => ps.map((p) => p._id))

		// Do the remove
		const allToRemove = [...removeFromDb, ...partInstancesToRemove]
		await Promise.all([
			removeFromDb.length > 0
				? context.directCollections.PartInstances.remove({
						_id: { $in: removeFromDb },
						rundownId: { $in: rundownIds },
				  })
				: undefined,
			allToRemove.length > 0
				? context.directCollections.PieceInstances.remove({
						partInstanceId: { $in: allToRemove },
						rundownId: { $in: rundownIds },
				  })
				: undefined,
		])
	})
}

export function substituteObjectIds(
	rawEnable: TSR.Timeline.TimelineEnable | TSR.Timeline.TimelineEnable[],
	idMap: { [oldId: string]: string | undefined }
): TSR.Timeline.TimelineEnable | TSR.Timeline.TimelineEnable[] {
	const replaceIds = (str: string) => {
		return str.replace(/#([\w]+)/g, (m) => {
			const id = m.slice(1)
			return `#${idMap[id] ?? id}`
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
	if (!currentPartInstance?.part?.autoNext) return false

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
	cache: PlayoutModel,
	partInstanceId: PartInstanceId
): void {
	const nextPartInstance = cache.getPartInstance(partInstanceId)
	if (nextPartInstance) {
		// Update expectedDurationWithPreroll of the next part instance, as it may have changed and is used by the ui until it is taken
		nextPartInstance.recalculateExpectedDurationWithPreroll()
	}
}
