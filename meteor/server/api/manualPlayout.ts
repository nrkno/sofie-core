import {
	registerClassToMeteorMethods
} from '../methods'
import { NewManualPlayoutAPI, ManualPlayoutAPIMethods } from '../../lib/api/manualPlayout'
import { Timeline, TimelineObjGeneric, getTimelineId, TimelineObjType } from '../../lib/collections/Timeline'
import { Studios, StudioId } from '../../lib/collections/Studios'
import { afterUpdateTimeline } from './playout/timeline'
import { check } from 'meteor/check'
import { makePromise } from '../../lib/lib'
import { ServerClientAPI } from './client'
import { MethodContext } from '../../lib/api/methods'
import { TimelineObjectCoreExt } from 'tv-automation-sofie-blueprints-integration'

function insertTimelineObject (studioId: StudioId, timelineObjectOrg: TimelineObjectCoreExt) {
	check(studioId, String)

	const timelineObject: TimelineObjGeneric = {
		...timelineObjectOrg,

		_id: getTimelineId(studioId, timelineObjectOrg.id),
		studioId: studioId,
		objectType: TimelineObjType.MANUAL
	}

	let studio = Studios.findOne(studioId)

	Timeline.upsert(timelineObject._id, timelineObject)

	if (studio) {
		afterUpdateTimeline(studio)
	}

}
function removeTimelineObject (studioId: StudioId, id: string) {
	check(studioId, String)
	check(id, String)
	let studio = Studios.findOne(studioId)

	if (studio) {
		Timeline.remove(getTimelineId(studio._id, id))

		afterUpdateTimeline(studio)
	}

}

class ServerManualPlayoutAPI implements NewManualPlayoutAPI {
	insertTimelineObject (studioId: StudioId, timelineObject: TimelineObjectCoreExt) {
		return makePromise(() => insertTimelineObject(studioId, timelineObject))
	}
	removeTimelineObject (studioId: StudioId, id: string) {
		return makePromise(() => removeTimelineObject(studioId, id))
	}
}
registerClassToMeteorMethods(ManualPlayoutAPIMethods, ServerManualPlayoutAPI, false, (methodContext: MethodContext, methodName: string, args: any[], fcn: Function) => {
	return ServerClientAPI.runInUserLog(methodContext, '', methodName, args, () => {
		return fcn.apply(methodContext, args)
	})
})
