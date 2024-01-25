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
export async function resetRundownPlaylist(context: JobContext, playoutModel: PlayoutModel): Promise<void> {
	logger.info('resetRundownPlaylist ' + playoutModel.playlist._id)
	// Remove all dunamically inserted pieces (adlibs etc)
	// const rundownIds = new Set((playoutModel.getRundownIds()))

	playoutModel.resetPlaylist(!!playoutModel.playlist.activationId)

	playoutModel.removeAllRehearsalPartInstances()
	resetPartInstancesWithPieceInstances(context, playoutModel)

	// Remove the scratchpad
	for (const rundown of playoutModel.rundowns) {
		rundown.removeScratchpadSegment()
	}

	if (playoutModel.playlist.activationId) {
		// put the first on queue:
		const firstPart = selectNextPart(
			context,
			playoutModel.playlist,
			null,
			null,
			playoutModel.getAllOrderedSegments(),
			playoutModel.getAllOrderedParts()
		)
		await setNextPart(context, playoutModel, firstPart, false)
	} else {
		await setNextPart(context, playoutModel, null, false)
	}
}

/**
 * Reset selected or all partInstances with their pieceInstances
 * @param playoutModel
 * @param selector if not provided, all partInstances will be reset
 */
export function resetPartInstancesWithPieceInstances(
	context: JobContext,
	playoutModel: PlayoutModel,
	selector?: MongoQuery<DBPartInstance>
): void {
	const partInstanceIdsToReset: PartInstanceId[] = []
	for (const partInstance of playoutModel.loadedPartInstances) {
		if (!partInstance.partInstance.reset && (!selector || mongoWhere(partInstance.partInstance, selector))) {
			partInstance.markAsReset()
			partInstanceIdsToReset.push(partInstance.partInstance._id)
		}
	}

	// Defer ones which arent loaded
	playoutModel.deferAfterSave(async (playoutModel) => {
		const rundownIds = playoutModel.getRundownIds()
		const partInstanceIdsInModel = playoutModel.loadedPartInstances.map((p) => p.partInstance._id)

		// Find all the partInstances which are not loaded, but should be reset
		const resetInDb = await context.directCollections.PartInstances.findFetch(
			{
				$and: [
					selector ?? {},
					{
						// Not any which are in the model, as they have already been done if needed
						_id: { $nin: partInstanceIdsInModel },
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
