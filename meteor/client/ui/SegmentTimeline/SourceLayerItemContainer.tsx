import * as React from 'react'
import * as _ from 'underscore'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { TriggerType } from 'superfly-timeline'
import { Timeline } from '../../../lib/collections/Timeline'
import { SourceLayerItem } from './SourceLayerItem'
import { PlayoutTimelinePrefixes } from '../../../lib/api/playout'
import { getCurrentTime } from '../../../lib/lib'

import {
	ISourceLayerUi,
	IOutputLayerUi,
	SegmentUi,
	SegmentLineUi,
	SegmentLineItemUi
} from './SegmentTimelineContainer'
import { RundownAPI } from '../../../lib/api/rundown'

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
	autoNextSegmentLine: boolean
	liveLineHistorySize: number
	livePosition: number | null
	liveLinePadding: number
	scrollLeft: number
	scrollWidth: number
}
/** This is a container component that allows ractivity with the Timeline collection */
export const SourceLayerItemContainer = withTracker((props: IPropsHeader) => {
	let overrides: {
		[key: string]: any
	} = {}

	// Override based on Timeline collection
	if (props.isLiveLine) {
		// Check in Timeline collection for any changes to the related object
		let timelineObj = Timeline.findOne({ _id: PlayoutTimelinePrefixes.SEGMENT_LINE_ITEM_GROUP_PREFIX + props.segmentLineItem._id })

		if (timelineObj) {
			let segmentCopy = (_.clone(overrides.segmentLineItem || props.segmentLineItem) as SegmentLineItemUi)

			segmentCopy.trigger = timelineObj.trigger
			if (timelineObj.trigger.type === TriggerType.TIME_ABSOLUTE) {
				if (_.isNumber(timelineObj.trigger.value)) { // this is a normal absolute trigger value
					segmentCopy.renderedInPoint = (timelineObj.trigger.value as number)
				} else if (timelineObj.trigger.value === 'now') { // this is a special absolute trigger value
					if (props.segmentLine && props.segmentLine.startedPlayback) {
						segmentCopy.renderedInPoint = getCurrentTime() - props.segmentLine.startedPlayback
					} else {
						segmentCopy.renderedInPoint = 0
					}
				} else {
					segmentCopy.renderedInPoint = 0
				}
			}
			segmentCopy.renderedDuration = timelineObj.duration !== 0 ? timelineObj.duration : undefined

			overrides.segmentLineItem = _.extend(overrides.segmentLineItem || {}, segmentCopy)
		}
	}

	// Check item status
	if (props.segmentLineItem.sourceLayer) {
		let newStatus: RundownAPI.LineItemStatusCode = RundownAPI.LineItemStatusCode.UNKNOWN
		switch (props.segmentLineItem.sourceLayer.type) {
			case RundownAPI.SourceLayerType.VT:
				newStatus = RundownAPI.LineItemStatusCode.SOURCE_MISSING
				break
			case RundownAPI.SourceLayerType.LIVE_SPEAK:
				newStatus = RundownAPI.LineItemStatusCode.SOURCE_MISSING
				break
		}
		if (newStatus !== props.segmentLineItem.status) {
			let segmentCopy = (_.clone(overrides.segmentLineItem || props.segmentLineItem) as SegmentLineItemUi)

			segmentCopy.status = newStatus

			overrides.segmentLineItem = _.extend(overrides.segmentLineItem || {}, segmentCopy)
		}
	}

	return overrides
})(
class extends React.Component<IPropsHeader> {
	render () {
		return (
			<SourceLayerItem {...this.props} />
		)
	}
}
)
