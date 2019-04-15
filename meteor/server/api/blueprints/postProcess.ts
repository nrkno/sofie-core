import * as _ from 'underscore'
import { SegmentLineItem } from '../../../lib/collections/SegmentLineItems'
import { SegmentLineAdLibItem } from '../../../lib/collections/SegmentLineAdLibItems'
import { extendMandadory, getHash } from '../../../lib/lib'
import {
	TimelineObjGeneric,
	TimelineObjRunningOrder,
	TimelineObjType
} from '../../../lib/collections/Timeline'
import { StudioInstallation } from '../../../lib/collections/StudioInstallations'
import { Meteor } from 'meteor/meteor'
import {
	TimelineObjectCoreExt,
	IBlueprintSegmentLineItem,
	IBlueprintSegmentLineAdLibItem,
	RunningOrderContext as IRunningOrderContext,
	RunningOrderContext,
} from 'tv-automation-sofie-blueprints-integration'
import { RunningOrderAPI } from '../../../lib/api/runningOrder'
import { Timeline } from 'timeline-state-resolver-types'

export function postProcessSegmentLineItems (innerContext: IRunningOrderContext, segmentLineItems: IBlueprintSegmentLineItem[], blueprintId: string, segmentLineId: string): SegmentLineItem[] {
	let i = 0
	let segmentLinesUniqueIds: { [id: string]: true } = {}
	return _.map(_.compact(segmentLineItems), (itemOrig: IBlueprintSegmentLineItem) => {
		let item: SegmentLineItem = {
			runningOrderId: innerContext.runningOrder._id,
			segmentLineId: segmentLineId,
			status: RunningOrderAPI.LineItemStatusCode.UNKNOWN,
			...itemOrig
		}

		if (!item._id) item._id = innerContext.getHashId(`${blueprintId}_${segmentLineId}_sli_${i++}`)
		if (!item.externalId && !item.isTransition) throw new Meteor.Error(400, 'Error in blueprint "' + blueprintId + '": externalId not set for segmentLineItem in ' + segmentLineId + '! ("' + innerContext.unhashId(item._id) + '")')

		if (segmentLinesUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in blueprint "' + blueprintId + '": ids of segmentLineItems must be unique! ("' + innerContext.unhashId(item._id) + '")')
		segmentLinesUniqueIds[item._id] = true

		if (item.content && item.content.timelineObjects) {
			let timelineUniqueIds: { [id: string]: true } = {}
			item.content.timelineObjects = _.map(_.compact(item.content.timelineObjects), (o: TimelineObjectCoreExt) => {
				const item = convertTimelineObject(innerContext.runningOrder._id, o)

				if (!item._id) item._id = innerContext.getHashId(blueprintId + '_' + (i++))

				if (timelineUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in blueprint "' + blueprintId + '": ids of timelineObjs must be unique! ("' + innerContext.unhashId(item._id) + '")')
				timelineUniqueIds[item._id] = true

				return item
			})
		}

		return item
	})
}

export function postProcessSegmentLineAdLibItems (innerContext: IRunningOrderContext, segmentLineAdLibItems: IBlueprintSegmentLineAdLibItem[], blueprintId: string, segmentLineId?: string): SegmentLineAdLibItem[] {
	let i = 0
	let segmentLinesUniqueIds: { [id: string]: true } = {}
	return _.map(_.compact(segmentLineAdLibItems), (itemOrig: IBlueprintSegmentLineAdLibItem) => {
		let item: SegmentLineAdLibItem = {
			_id: innerContext.getHashId(`${blueprintId}_${segmentLineId}_adlib_sli_${i++}`),
			runningOrderId: innerContext.runningOrder._id,
			segmentLineId: segmentLineId,
			status: RunningOrderAPI.LineItemStatusCode.UNKNOWN,
			trigger: undefined,
			disabled: false,
			...itemOrig
		}

		if (!item.externalId) throw new Meteor.Error(400, 'Error in blueprint "' + blueprintId + '": externalId not set for segmentLineItem in ' + segmentLineId + '! ("' + innerContext.unhashId(item._id) + '")')

		if (segmentLinesUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in blueprint "' + blueprintId + '": ids of segmentLineItems must be unique! ("' + innerContext.unhashId(item._id) + '")')
		segmentLinesUniqueIds[item._id] = true

		if (item.content && item.content.timelineObjects) {
			let timelineUniqueIds: { [id: string]: true } = {}
			item.content.timelineObjects = _.map(_.compact(item.content.timelineObjects), (o: TimelineObjectCoreExt) => {
				const item = convertTimelineObject(innerContext.runningOrder._id, o)

				if (!item._id) item._id = innerContext.getHashId(blueprintId + '_adlib_' + (i++))

				if (timelineUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in blueprint "' + blueprintId + '": ids of timelineObjs must be unique! ("' + innerContext.unhashId(item._id) + '")')
				timelineUniqueIds[item._id] = true

				return item
			})
		}

		return item
	})
}

export function postProcessStudioBaselineObjects (studio: StudioInstallation, objs: Timeline.TimelineObject[]): TimelineObjRunningOrder[] {
	let timelineUniqueIds: { [id: string]: true } = {}
	return _.map(objs, (o, i) => {
		const item = convertTimelineObject('', o)

		if (!item._id) item._id = getHash(studio._id + '_baseline_' + (i++))

		if (timelineUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in blueprint "' + studio.blueprintId + '": ids of timelineObjs must be unique! ("' + item._id + '")')
		timelineUniqueIds[item._id] = true

		return item
	})
}

function convertTimelineObject (runningOrderId: string, o: TimelineObjectCoreExt): TimelineObjRunningOrder {
	let item: TimelineObjRunningOrder = extendMandadory<TimelineObjectCoreExt, TimelineObjRunningOrder>(o, {
		_id: o.id,
		siId: '', // set later
		roId: runningOrderId,
		objectType: TimelineObjType.RUNNINGORDER,
	})
	delete item['id']

	return item
}

export function postProcessSegmentLineBaselineItems (innerContext: RunningOrderContext, baselineItems: Timeline.TimelineObject[]): TimelineObjGeneric[] {
	let i = 0
	let timelineUniqueIds: { [id: string]: true } = {}

	return _.map(_.compact(baselineItems), (o: TimelineObjGeneric): TimelineObjGeneric => {
		const item: TimelineObjGeneric = convertTimelineObject(innerContext.runningOrder._id, o)

		if (!item._id) item._id = innerContext.getHashId('baseline_' + (i++))

		if (timelineUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in baseline blueprint: ids of timelineObjs must be unique! ("' + innerContext.unhashId(item._id) + '")')
		timelineUniqueIds[item._id] = true
		return item
	})
}
