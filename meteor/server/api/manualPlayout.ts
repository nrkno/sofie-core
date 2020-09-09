import { registerClassToMeteorMethods } from '../methods'
import { NewManualPlayoutAPI, ManualPlayoutAPIMethods } from '../../lib/api/manualPlayout'
import {
	Timeline,
	TimelineObjGeneric,
	getTimelineId,
	TimelineObjType,
	TimelineObjId,
} from '../../lib/collections/Timeline'
import { Studios, StudioId } from '../../lib/collections/Studios'
import { check } from '../../lib/check'
import { makePromise, waitForPromise, protectString } from '../../lib/lib'
import { ServerClientAPI } from './client'
import { MethodContext, MethodContextAPI } from '../../lib/api/methods'
import { TimelineObjectCoreExt } from 'tv-automation-sofie-blueprints-integration'
import { StudioContentWriteAccess } from '../security/studio'
import { CacheForStudio, initCacheForNoRundownPlaylist, CacheForStudioBase } from '../DatabaseCaches'
import { time, timeline } from 'console'

function insertTimelineObject(
	context: MethodContext,
	cache: CacheForStudioBase,
	studioId: StudioId,
	timelineObjectOrg: TimelineObjectCoreExt
) {
	check(studioId, String)

	StudioContentWriteAccess.timeline(context, studioId)

	const timelineObject: TimelineObjGeneric = {
		...timelineObjectOrg,

		_id: getTimelineId(studioId, timelineObjectOrg.id),
		studioId: studioId,
		objectType: TimelineObjType.MANUAL,
	}

	const studio = Studios.findOne(studioId)
	const studioTimeline = cache.Timeline.findOne({ _id: studioId })
	if (studio && studioTimeline) {
		const indexOfExisting = studioTimeline.timeline.map((x) => x._id).indexOf(timelineObject._id)
		if (indexOfExisting >= 0) {
			studioTimeline.timeline[indexOfExisting] = timelineObject
		} else {
			studioTimeline.timeline.push(timelineObject)
		}
		cache.Timeline.update(studioId, studioTimeline)
	}
}
function removeTimelineObject(context: MethodContext, cache: CacheForStudioBase, studioId: StudioId, id: string) {
	check(studioId, String)
	check(id, String)

	StudioContentWriteAccess.timeline(context, studioId)

	const studio = Studios.findOne(studioId)
	const studioTimeline = cache.Timeline.findOne({ _id: studioId })
	if (studio && studioTimeline) {
		studioTimeline.timeline = studioTimeline.timeline.filter((x, index) => x._id !== protectString(id))
		cache.Timeline.update(studioId, studioTimeline)
	}
}

class ServerManualPlayoutAPI extends MethodContextAPI implements NewManualPlayoutAPI {
	insertTimelineObject(studioId: StudioId, timelineObject: TimelineObjectCoreExt) {
		return makePromise(() => {
			const cache = waitForPromise(initCacheForNoRundownPlaylist(studioId))
			insertTimelineObject(this, cache, studioId, timelineObject)
			waitForPromise(cache.saveAllToDatabase())
		})
	}
	removeTimelineObject(studioId: StudioId, id: string) {
		return makePromise(() => {
			const cache = waitForPromise(initCacheForNoRundownPlaylist(studioId))
			removeTimelineObject(this, cache, studioId, id)
			waitForPromise(cache.saveAllToDatabase())
		})
	}
}
registerClassToMeteorMethods(
	ManualPlayoutAPIMethods,
	ServerManualPlayoutAPI,
	false,
	(methodContext: MethodContext, methodName: string, args: any[], fcn: Function) => {
		return ServerClientAPI.runInUserLog(methodContext, '', methodName, args, () => {
			return fcn.apply(methodContext, args)
		})
	}
)
