import {
	setMeteorMethods,
	wrapMethods,
	Methods
} from '../methods'
import { ManualPlayoutAPI } from '../../lib/api/manualPlayout'
import { Timeline, TimelineObjGeneric } from '../../lib/collections/Timeline'
import { StudioInstallations } from '../../lib/collections/StudioInstallations'
import { afterUpdateTimeline } from './playout'

function insertTimelineObject (studioId: string, timelineObject: TimelineObjGeneric) {
	let id = studioId + (timelineObject._id || timelineObject.id)
	timelineObject._id = id
	timelineObject.id = id

	timelineObject.siId = studioId

	let studio = StudioInstallations.findOne(studioId)

	Timeline.upsert(timelineObject._id, timelineObject)

	if (studio) {

		afterUpdateTimeline(studio)
	}

}
function removeTimelineObject (studioId: string, id: string) {
	let studio = StudioInstallations.findOne(studioId)

	if (studio) {
		Timeline.remove({
			siId: studio._id,
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
setMeteorMethods(wrapMethods(methods))
