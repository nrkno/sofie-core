import { TimelineObjectCoreExt } from 'tv-automation-sofie-blueprints-integration'
import { ManualPlayoutAPIMethods, NewManualPlayoutAPI } from '../../lib/api/manualPlayout'
import { MethodContext, MethodContextAPI } from '../../lib/api/methods'
import { check } from '../../lib/check'
import { StudioId } from '../../lib/collections/Studios'
import { getTimelineId, TimelineObjGeneric, TimelineObjType } from '../../lib/collections/Timeline'
import { makePromise, waitForPromise } from '../../lib/lib'
import { CacheForStudio, initCacheForNoRundownPlaylist } from '../DatabaseCaches'
import { registerClassToMeteorMethods } from '../methods'
import { StudioContentWriteAccess } from '../security/studio'
import { ServerClientAPI } from './client'
import { afterUpdateTimeline } from './playout/timeline'

function insertTimelineObject(
	context: MethodContext,
	cache: CacheForStudio,
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

	let studio = cache.Studios.findOne(studioId)

	if (studio) {
		cache.Timeline.upsert(timelineObject._id, timelineObject)
		afterUpdateTimeline(cache, studio._id)
	}
}
function removeTimelineObject(context: MethodContext, cache: CacheForStudio, studioId: StudioId, id: string) {
	check(studioId, String)
	check(id, String)

	StudioContentWriteAccess.timeline(context, studioId)

	let studio = cache.Studios.findOne(studioId)

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
