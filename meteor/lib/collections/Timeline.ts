import { createMongoCollection } from './lib'
import { MappingsHash, ResultingMappingRoutes } from './Studios'
import { StudioId, TimelineObjId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { TimelineObjId }
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import {
	TimelineComplete,
	TimelineHash,
	TimelineObjGeneric,
	updateLookaheadLayer,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { Time } from '@sofie-automation/blueprints-integration'
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

export interface RoutedTimeline {
	_id: StudioId
	mappingsHash: MappingsHash | undefined
	timelineHash: TimelineHash | undefined
	timeline: TimelineObjGeneric[]
	generated: Time
	published: Time
}

// export const Timeline = createMongoCollection<TimelineObj>('timeline')
export const Timeline = createMongoCollection<TimelineComplete, TimelineComplete>(CollectionName.Timelines)

// Note: this index is always created by default, so it's not needed.
// registerIndex(Timeline, {
// 	_id: 1,
// })
