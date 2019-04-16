import {
	setMeteorMethods,
	Methods
} from '../methods'
import { ManualPlayoutAPI } from '../../lib/api/manualPlayout'
import { Timeline, TimelineObjGeneric } from '../../lib/collections/Timeline'
import { Studios } from '../../lib/collections/Studios'
import { afterUpdateTimeline } from './playout'

function insertTimelineObject (studioId: string, timelineObject: TimelineObjGeneric) {
	let id = studioId + (timelineObject._id || timelineObject.id)
	timelineObject._id = id
	timelineObject.id = id

	timelineObject.studioId = studioId

	let studio = Studios.findOne(studioId)

	Timeline.upsert(timelineObject._id, timelineObject)

	if (studio) {

		afterUpdateTimeline(studio)
	}

}
function removeTimelineObject (studioId: string, id: string) {
	let studio = Studios.findOne(studioId)

	if (studio) {
		Timeline.remove({
			studioId: studio._id,
			_id: studioId + id
		})

		afterUpdateTimeline(studio)
	}

}

let methods: Methods = {}
methods[ManualPlayoutAPI.methods.insertTimelineObject] = (studioId: string, timelineObject: TimelineObjGeneric) => {
	return insertTimelineObject(studioId, timelineObject)
}
methods[ManualPlayoutAPI.methods.removeTimelineObject] = (studioId: string, id: string) => {
	return removeTimelineObject(studioId, id)
}

// Apply methods:
setMeteorMethods(methods)
