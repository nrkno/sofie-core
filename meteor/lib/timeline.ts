import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { TimelineObjGeneric, TimelineObjGroup } from './collections/Timeline'
import { TimelineObject } from 'superfly-timeline'
import { clone } from './lib'

// This is a collection of functions that match what the playout-gateway / TSR does
// playout-gateway:
export function transformTimeline (timeline: Array<TimelineObjGeneric>): Array<TimelineContentObject> {

	let transformObject = (obj: TimelineObjGeneric | TimelineObjGroup): TimelineContentObject => {
		if (!obj.id) throw new Meteor.Error(500, `Timeline object missing id attribute (_id: "${obj._id}") `)
		let transformedObj: TimelineContentObject = clone(
			_.omit(
				{
					...obj,
					rundownId: obj.rundownId
				}, ['_id', 'deviceId', 'studioId']
			)
	   )

		if (!transformedObj.content) transformedObj.content = {}

		if (obj['partId']) {
			// Will cause a callback to be called, when the object starts to play:
			transformedObj.content.callBack = 'partPlaybackStarted'
			transformedObj.content.callBackData = {
				rundownId: obj.rundownId,
				partId: obj['partId']
			}
			transformedObj.content.callBackStopped = 'partPlaybackStopped'
	   }
		if (obj['pieceId']) {
			// Will cause a callback to be called, when the object starts to play:
			transformedObj.content.callBack = 'piecePlaybackStarted'
			transformedObj.content.callBackData = {
				rundownId: obj.rundownId,
				pieceId: obj['pieceId']
			}
			transformedObj.content.callBackStopped = 'piecePlaybackStopped'
		}

	   return transformedObj
	}

	let groupObjects: {[id: string]: TimelineContentObject} = {}
	let transformedTimeline: Array<TimelineContentObject> = []
	let doTransform = (objs: Array<TimelineObjGeneric | TimelineObjGroup>) => {
		let objsLeft: Array<TimelineObjGeneric | TimelineObjGroup> = []
		let changedSomething: boolean = false
		_.each(objs, (obj: TimelineObjGeneric | TimelineObjGroup) => {

			let transformedObj = transformObject(obj)

			if (obj.isGroup) {
				groupObjects[transformedObj.id] = transformedObj
				changedSomething = true
				if (!obj['children']) obj['children'] = []
			}
			if (obj.inGroup) {
				let groupObj = groupObjects[obj.inGroup]
				if (groupObj) {
					// Add object into group:
					if (!groupObj.children) groupObj.children = []

					groupObj.children.push(transformedObj)
					changedSomething = true

				} else {
					// referenced group not found, try again later:
					objsLeft.push(obj)
				}
			} else {
				// Add object to timeline
				transformedTimeline.push(transformedObj)
				changedSomething = true
			}
		})
		// Iterate again?
		if (objsLeft.length && changedSomething) {
			doTransform(objsLeft)
		}
	}
	doTransform(timeline)
	return transformedTimeline

}

// TSR: ---------
export interface TimelineContentObject extends TimelineObject {
}
