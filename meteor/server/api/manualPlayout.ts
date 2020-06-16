import {
	registerClassToMeteorMethods
} from '../methods'
import { NewManualPlayoutAPI, ManualPlayoutAPIMethods } from '../../lib/api/manualPlayout'
import { Timeline, TimelineObjGeneric, getTimelineId, TimelineObjType } from '../../lib/collections/Timeline'
import { Studios, StudioId } from '../../lib/collections/Studios'
import { afterUpdateTimeline } from './playout/timeline'
import { check } from 'meteor/check'
import { makePromise, waitForPromise } from '../../lib/lib'
import { ServerClientAPI } from './client'
import { MethodContext } from '../../lib/api/methods'
import { TimelineObjectCoreExt } from 'tv-automation-sofie-blueprints-integration'
import { CacheForStudio, initCacheForNoRundownPlaylist } from '../DatabaseCaches'

function insertTimelineObject (cache: CacheForStudio, studioId: StudioId, timelineObjectOrg: TimelineObjectCoreExt) {
	check(studioId, String)

	const timelineObject: TimelineObjGeneric = {
		...timelineObjectOrg,

		_id: getTimelineId(studioId, timelineObjectOrg.id),
		studioId: studioId,
		objectType: TimelineObjType.MANUAL
	}

	let studio = cache.Studios.findOne(studioId)
	
	if (studio) {
		cache.Timeline.upsert(timelineObject._id, timelineObject)
		afterUpdateTimeline(cache, studio._id)
	}

}
function removeTimelineObject (cache: CacheForStudio, studioId: StudioId, id: string) {
	check(studioId, String)
	check(id, String)
	let studio = cache.Studios.findOne(studioId)

	if (studio) {
		cache.Timeline.remove(getTimelineId(studio._id, id))

		afterUpdateTimeline(cache, studio._id)
	}

}

class ServerManualPlayoutAPI implements NewManualPlayoutAPI {
	insertTimelineObject (studioId: StudioId, timelineObject: TimelineObjectCoreExt) {
		return makePromise(() => {
			const cache = waitForPromise(initCacheForNoRundownPlaylist(studioId))
			insertTimelineObject(cache, studioId, timelineObject)
			waitForPromise(cache.saveAllToDatabase())
		})
	}
	removeTimelineObject (studioId: StudioId, id: string) {
		return makePromise(() => {
			const cache = waitForPromise(initCacheForNoRundownPlaylist(studioId))
			removeTimelineObject(cache, studioId, id)
			waitForPromise(cache.saveAllToDatabase())
		})
	}
}
registerClassToMeteorMethods(ManualPlayoutAPIMethods, ServerManualPlayoutAPI, false, (methodContext: MethodContext, methodName: string, args: any[], fcn: Function) => {
	return ServerClientAPI.runInUserLog(methodContext, '', methodName, args, () => {
		return fcn.apply(methodContext, args)
	})
})
