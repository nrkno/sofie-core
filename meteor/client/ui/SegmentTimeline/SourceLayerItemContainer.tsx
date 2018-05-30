import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as _ from 'underscore'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { TriggerType } from 'superfly-timeline'

import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { Timeline } from '../../../lib/collections/Timeline'

import { SourceLayerItem } from './SourceLayerItem'

import { PlayoutTimelinePrefixes } from '../../../lib/api/playout'

import {
	ISourceLayerUi,
	IOutputLayerUi,
	SegmentUi,
	SegmentLineUi,
	SegmentLineItemUi
} from './SegmentTimelineContainer'

interface IPropsHeader {
	layer: ISourceLayerUi
	outputLayer: IOutputLayerUi
	segment: SegmentUi
	segmentLine: SegmentLineUi
	segmentLineStartsAt: number
	segmentLineDuration: number
	segmentLineItem: SegmentLineItemUi
	timeScale: number
	isLiveLine: boolean
	isNextLine: boolean
	onFollowLiveLine?: (state: boolean, event: any) => void
	relative?: boolean
	outputGroupCollapsed: boolean
	followLiveLine: boolean
	liveLineHistorySize: number
	livePosition: number | null
	liveLinePadding: number
}
/** This is a container component that allows ractivity with the Timeline collection */
export const SourceLayerItemContainer = withTracker((props) => {
	if (props.isLiveLine) {
		// Check in Timeline collection for any changes to the related object
		let timelineObj = Timeline.findOne({ _id: PlayoutTimelinePrefixes.SEGMENT_LINE_ITEM_GROUP_PREFIX + props.segmentLineItem._id })

		if (timelineObj) {
			let segmentCopy = (_.clone(props.segmentLineItem) as SegmentLineItemUi)

			segmentCopy.trigger = timelineObj.trigger
			if (timelineObj.trigger.type === TriggerType.TIME_ABSOLUTE) {
				if (_.isNumber(timelineObj.trigger.value)) { // this is a normal absolute trigger value
					segmentCopy.renderedInPoint = (timelineObj.trigger.value as number)
				} else if (timelineObj.trigger.value === 'now') { // this is a special absolute trigger value
					segmentCopy.renderedInPoint = 0
				} else {
					segmentCopy.renderedInPoint = 0
				}
			}
			// if duration is 0, the item is in fact infinite
			segmentCopy.renderedDuration = Math.min(timelineObj.duration === 0 ? (props.segmentLineDuration - segmentCopy.renderedInPoint! + props.liveLinePadding) : timelineObj.duration,
				Math.max((props.livePosition || 0) + props.liveLinePadding, (props.segmentLineDuration - segmentCopy.renderedInPoint!))
			)

			return {
				segmentLineItem: segmentCopy
			}
		} else {
			// object not found in timeline, don't override any values
			return {}
		}
	} else {
		// Don't expect any changes
		return {}
	}
})(
class extends React.Component<IPropsHeader> {
	render () {
		return (
			// The following code is fine, just withTracker HOC messing with available props
			// @ts-ignore
			<SourceLayerItem {...this.props} />
		)
	}
}
)
