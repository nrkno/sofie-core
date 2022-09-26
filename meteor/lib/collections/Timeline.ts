import { createMongoCollection } from './lib'
import { DBStudio, ResultingMappingRoutes } from './Studios'
import { StudioId, TimelineObjId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { TimelineObjId }
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import {
	TimelineComplete,
	TimelineObjGeneric,
	updateLookaheadLayer,
	TimelineBlob,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
export * from '@sofie-automation/corelib/dist/dataModel/Timeline'

export function getRoutedTimeline(
	inputTimelineObjs: TimelineObjGeneric[],
	mappingRoutes: ResultingMappingRoutes
): TimelineObjGeneric[] {
	const outputTimelineObjs: TimelineObjGeneric[] = []

	for (const obj of inputTimelineObjs) {
		let inputLayer = obj.layer + ''
		if (obj.isLookahead && obj.lookaheadForLayer) {
			// For lookahead objects, .layer doesn't point to any real layer
			inputLayer = obj.lookaheadForLayer + ''
		}
		const routes = mappingRoutes.existing[inputLayer]
		if (routes) {
			for (let i = 0; i < routes.length; i++) {
				const route = routes[i]
				const routedObj: TimelineObjGeneric = {
					...obj,
					layer: route.outputMappedLayer,
				}
				if (routedObj.isLookahead && routedObj.lookaheadForLayer) {
					// Update lookaheadForLayer to reference the original routed layer:
					updateLookaheadLayer(routedObj)
				}
				if (i > 0) {
					// If there are multiple routes we must rename the ids, so that they stay unique.
					routedObj.id = `_${i}_${routedObj.id}`

					if (routedObj.keyframes) {
						routedObj.keyframes = routedObj.keyframes.map((keyframe) => ({
							...keyframe,
							id: `_${i}_${keyframe.id}`,
						}))
					}
				}
				outputTimelineObjs.push(routedObj)
			}
		} else {
			// If no route is found at all, pass it through (backwards compatibility)
			outputTimelineObjs.push(obj)
		}
	}
	return outputTimelineObjs
}

/** This is the data-object published from Core */
export interface RoutedTimeline {
	_id: StudioId
	/** Hash of the studio mappings */
	mappingsHash: DBStudio['mappingsHash']

	/** Hash of the Timeline */
	timelineHash: TimelineComplete['timelineHash']

	/** serialized JSON Array containing all timeline-objects */
	timelineBlob: TimelineBlob
	generated: TimelineComplete['generated']
}

export const Timeline = createMongoCollection<TimelineComplete>(CollectionName.Timelines)

// Note: this index is always created by default, so it's not needed.
// registerIndex(Timeline, {
// 	_id: 1,
// })
