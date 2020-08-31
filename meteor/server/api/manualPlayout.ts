import { registerClassToMeteorMethods } from '../methods'
import { NewManualPlayoutAPI, ManualPlayoutAPIMethods } from '../../lib/api/manualPlayout'
import { Timeline, TimelineObjGeneric, getTimelineId, TimelineObjType } from '../../lib/collections/Timeline'
import { Studios, StudioId } from '../../lib/collections/Studios'
import { afterUpdateTimeline } from './playout/timeline'
import { check } from '../../lib/check'
import { makePromise, waitForPromise } from '../../lib/lib'
import { ServerClientAPI } from './client'
import { MethodContext, MethodContextAPI } from '../../lib/api/methods'
import { TimelineObjectCoreExt } from 'tv-automation-sofie-blueprints-integration'
import { StudioContentWriteAccess } from '../security/studio'
import { CacheForStudio, initCacheForNoRundownPlaylist, CacheForStudioBase } from '../DatabaseCaches'

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
	if (studio) {
		cache.Timeline.upsert(timelineObject._id, timelineObject)
		afterUpdateTimeline(cache, studioId)
	}
}
function removeTimelineObject(context: MethodContext, cache: CacheForStudioBase, studioId: StudioId, id: string) {
	check(studioId, String)
	check(id, String)

	StudioContentWriteAccess.timeline(context, studioId)

	const studio = Studios.findOne(studioId)
	if (studio) {
		cache.Timeline.remove(getTimelineId(studio._id, id))
		afterUpdateTimeline(cache, studio._id)
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
