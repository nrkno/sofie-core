import * as React from 'react'
import * as _ from 'underscore'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { TriggerType } from 'superfly-timeline'
import { Timeline } from '../../../lib/collections/Timeline'
import { SourceLayerItem } from './SourceLayerItem'
import { PlayoutTimelinePrefixes } from '../../../lib/api/playout'
import { getCurrentTime } from '../../../lib/lib'
import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { VTContent, LiveSpeakContent, SegmentLineItems } from '../../../lib/collections/SegmentLineItems'
import { MediaObjects } from '../../../lib/collections/MediaObjects'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
// @ts-ignore Meteor package not recognized by Typescript
import { ComputedField } from 'meteor/peerlibrary:computed-field'

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
	mediaPreviewUrl: string
	// segment: SegmentUi
	segmentLine: SegmentLineUi
	segmentLineStartsAt: number
	segmentLineDuration: number
	segmentLineItem: SegmentLineItemUi
	runningOrder: RunningOrder
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

	// Disable timeline override, since it became too complicated to correctly override SLI properties
	// with data from the Timeline
	// ---

	// Override based on Timeline collection
	if (props.isLiveLine) {
		// Check in Timeline collection for any changes to the related object
		let timelineObj = Timeline.findOne({ _id: PlayoutTimelinePrefixes.SEGMENT_LINE_ITEM_GROUP_PREFIX + props.segmentLineItem._id })

		if (timelineObj) {
			let segmentCopy = (_.clone(overrides.segmentLineItem || props.segmentLineItem) as SegmentLineItemUi)

			if (timelineObj.trigger.type === TriggerType.TIME_ABSOLUTE) {
				segmentCopy.trigger = timelineObj.trigger
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

			if (typeof timelineObj.duration !== 'string' && !segmentCopy.cropped) {
				segmentCopy.renderedDuration = timelineObj.duration !== 0 ? timelineObj.duration : (props.segmentLineDuration - (segmentCopy.renderedInPoint || 0))
			}
			// console.log(segmentCopy.renderedDuration)

			overrides.segmentLineItem = _.extend(overrides.segmentLineItem || {}, segmentCopy)
		}
	}

	// Check item status
	if (props.segmentLineItem.sourceLayer) {
		let newStatus: RundownAPI.LineItemStatusCode = RundownAPI.LineItemStatusCode.UNKNOWN
		let metadata: any = undefined
		switch (props.segmentLineItem.sourceLayer.type) {
			case RundownAPI.SourceLayerType.VT:
				if (props.segmentLineItem.content && props.segmentLineItem.content.fileName) {
					const content = props.segmentLineItem.content as VTContent
					const mediaObject = MediaObjects.findOne({
						objId: content.fileName.toUpperCase()
					})
					// If media object not found, then...
					if (!mediaObject) {
						newStatus = RundownAPI.LineItemStatusCode.SOURCE_MISSING
					// All VT content should have at least two streams
					} else if (mediaObject && mediaObject.mediainfo && mediaObject.mediainfo.streams.length < 2) {
						newStatus = RundownAPI.LineItemStatusCode.SOURCE_BROKEN
					} else if (mediaObject) {
						newStatus = RundownAPI.LineItemStatusCode.OK
					}

					if (mediaObject) {
						metadata = mediaObject
					}
				}
				break
			case RundownAPI.SourceLayerType.LIVE_SPEAK:
				if (props.segmentLineItem.content && props.segmentLineItem.content.fileName) {
					const content = props.segmentLineItem.content as LiveSpeakContent
					const mediaObject = MediaObjects.findOne({
						objId: content.fileName.toUpperCase()
					})
					// If media object not found, then...
					if (!mediaObject) {
						newStatus = RundownAPI.LineItemStatusCode.SOURCE_MISSING
						// All VT content should have at least two streams
					} else if (mediaObject && mediaObject.mediainfo && mediaObject.mediainfo.streams.length < 2) {
						newStatus = RundownAPI.LineItemStatusCode.SOURCE_BROKEN
					} else if (mediaObject) {
						newStatus = RundownAPI.LineItemStatusCode.OK
					}

					if (mediaObject) {
						metadata = mediaObject
					}
				}
				break
		}
		if (newStatus !== props.segmentLineItem.status || metadata) {
			let segmentCopy = (_.clone(overrides.segmentLineItem || props.segmentLineItem) as SegmentLineItemUi)

			segmentCopy.status = newStatus
			segmentCopy.metadata = metadata

			overrides.segmentLineItem = _.extend(overrides.segmentLineItem || {}, segmentCopy)
		}
	}

	return overrides
})(
class extends MeteorReactComponent<IPropsHeader> {
	componentWillMount () {
		let objIdCF = new ComputedField(() => {
			let sli = SegmentLineItems.findOne(this.props.segmentLineItem._id)
			if (sli) {
				if (this.props.segmentLineItem.sourceLayer) {
					switch (this.props.segmentLineItem.sourceLayer.type) {
						case RundownAPI.SourceLayerType.VT:
							return (sli.content as VTContent).fileName.toUpperCase()
						case RundownAPI.SourceLayerType.LIVE_SPEAK:
							return (sli.content as LiveSpeakContent).fileName.toUpperCase()
					}
				}
			}
			return ''
		})

		let prevSub: Meteor.SubscriptionHandle

		this.autorun(() => {
			let objId = objIdCF()
			if (objId) {
				if (prevSub) {
					prevSub.stop()
				}
				prevSub = this.subscribe('mediaObjects', this.props.runningOrder.studioInstallationId, {
					objId: objId
				})
			}
		})
	}
	render () {
		return (
			<SourceLayerItem {...this.props} />
		)
	}
}
)
