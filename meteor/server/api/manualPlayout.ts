import {
	setMeteorMethods,
	Methods
} from '../methods'
import { ManualPlayoutAPI } from '../../lib/api/manualPlayout'
import { Timeline, TimelineObjGeneric, getTimelineId } from '../../lib/collections/Timeline'
import { Studios, StudioId } from '../../lib/collections/Studios'
import { afterUpdateTimeline } from './playout/timeline'
import { check } from 'meteor/check'

function insertTimelineObject (studioId: StudioId, timelineObject: TimelineObjGeneric) {
	check(studioId, String)
	timelineObject.studioId = studioId
	timelineObject._id = getTimelineId(timelineObject)

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

let methods: Methods = {}
methods[ManualPlayoutAPI.methods.insertTimelineObject] = (studioId: StudioId, timelineObject: TimelineObjGeneric) => {
	return insertTimelineObject(studioId, timelineObject)
}
methods[ManualPlayoutAPI.methods.removeTimelineObject] = (studioId: StudioId, id: string) => {
	return removeTimelineObject(studioId, id)
}

// Apply methods:
setMeteorMethods(methods)
