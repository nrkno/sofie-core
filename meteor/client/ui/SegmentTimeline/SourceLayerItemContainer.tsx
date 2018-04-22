import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as _ from 'underscore'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { TriggerType } from 'superfly-timeline'

import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { Timeline } from '../../../lib/collections/Timeline'

import { SourceLayerItem } from './SourceLayerItem'

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
	segmentLineItem: SegmentLineItemUi
	timeScale: number
	isLiveLine: boolean
	isNextLine: boolean
	onFollowLiveLine?: (state: boolean, event: any) => void
	relative?: boolean
	totalSegmentLineDuration?: number
	followLiveLine: boolean
	liveLineHistorySize: number
	livePosition: number | null
}
/** This is an  */
export const SourceLayerItemContainer = withTracker((props) => {
	if (props.isLiveLine) {
		// Check in Timeline collection for any changes to the related object
		let timelineObj = Timeline.findOne({_id: props.segmentLineItem._id})

		if (timelineObj) {
			let segmentCopy = (_.clone(props.segmentLineItem) as SegmentLineItemUi)

			segmentCopy.trigger = timelineObj.trigger
			if (timelineObj.trigger.type === TriggerType.TIME_ABSOLUTE) {
				// if the TIME_ABSOLUTE is, the value is certainly a number
				segmentCopy.renderedInPoint = (timelineObj.trigger.value as number)
			}
			segmentCopy.renderedDuration = timelineObj.duration

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
			<SourceLayerItem {...this.props} />
		)
	}
}
)
