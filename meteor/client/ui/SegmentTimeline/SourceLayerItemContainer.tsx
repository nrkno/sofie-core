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
import { Meteor } from 'meteor/meteor'
import { checkSLIContentStatus } from '../../../lib/mediaObjects'
import {
	ISourceLayerUi,
	IOutputLayerUi,
	SegmentUi,
	SegmentLineUi,
	SegmentLineItemUi
} from './SegmentTimelineContainer'
import { RundownAPI } from '../../../lib/api/rundown'
import { Tracker } from 'meteor/tracker'

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
	onDoubleClick?: (item: SegmentLineItemUi, e: React.MouseEvent<HTMLDivElement>) => void
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
export const SourceLayerItemContainer = class extends MeteorReactComponent<IPropsHeader> {
	private mediaObjectSub: Meteor.SubscriptionHandle
	private statusComp: Tracker.Computation
	private objId: string
	private overrides: any

	updateMediaObjectSubscription () {
		if (this.props.segmentLineItem && this.props.segmentLineItem.sourceLayer) {
			const sli = this.props.segmentLineItem
			let objId: string | undefined = undefined

			switch (this.props.segmentLineItem.sourceLayer.type) {
				case RundownAPI.SourceLayerType.VT:
					objId = (sli.content as VTContent).fileName.toUpperCase()
					break
				case RundownAPI.SourceLayerType.LIVE_SPEAK:
					objId = (sli.content as LiveSpeakContent).fileName.toUpperCase()
					break
			}

			if (objId && objId !== this.objId) {
				// if (this.mediaObjectSub) this.mediaObjectSub.stop()
				this.objId = objId
				this.subscribe('mediaObjects', this.props.runningOrder.studioInstallationId, {
					mediaId: this.objId
				})
			}
		} else {
			console.error('One of the SegmentLineItem\'s is invalid:', this.props.segmentLineItem)
		}
	}

	shouldDataTrackerUpdate (prevProps: IPropsHeader): boolean {
		if (this.props.segmentLineItem !== prevProps.segmentLineItem) return true
		if (this.props.isLiveLine !== prevProps.isLiveLine) return true
		return false
	}

	updateDataTracker () {
		this.statusComp = this.autorun(() => {
			const props = this.props
			this.overrides = {}
			const overrides = this.overrides

			// console.log(`${this.props.segmentLineItem._id}: running data tracker`)

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
							if (props.segmentLine && props.segmentLine.startedPlayback && props.segmentLine.getLastStartedPlayback()) {
								segmentCopy.renderedInPoint = getCurrentTime() - (props.segmentLine.getLastStartedPlayback() || 0)
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
				// let newStatus: RundownAPI.LineItemStatusCode = RundownAPI.LineItemStatusCode.UNKNOWN
				// let metadata: any = undefined

				const { metadata, status } = checkSLIContentStatus(props.segmentLineItem, props.segmentLineItem.sourceLayer)

				// switch (props.segmentLineItem.sourceLayer.type) {
				// 	case RundownAPI.SourceLayerType.VT:
				// 		if (props.segmentLineItem.content && props.segmentLineItem.content.fileName) {
				// 			const content = props.segmentLineItem.content as VTContent
				// 			const mediaObject = MediaObjects.findOne({
				// 				mediaId: content.fileName.toUpperCase()
				// 			})
				// 			// If media object not found, then...
				// 			if (!mediaObject) {
				// 				newStatus = RundownAPI.LineItemStatusCode.SOURCE_MISSING
				// 				// All VT content should have at least two streams
				// 			} else if (mediaObject && mediaObject.mediainfo && mediaObject.mediainfo.streams.length < 2) {
				// 				newStatus = RundownAPI.LineItemStatusCode.SOURCE_BROKEN
				// 			} else if (mediaObject) {
				// 				newStatus = RundownAPI.LineItemStatusCode.OK
				// 			}

				// 			if (mediaObject) {
				// 				metadata = mediaObject
				// 			}
				// 		}
				// 		break
				// 	case RundownAPI.SourceLayerType.LIVE_SPEAK:
				// 		if (props.segmentLineItem.content && props.segmentLineItem.content.fileName) {
				// 			const content = props.segmentLineItem.content as LiveSpeakContent
				// 			const mediaObject = MediaObjects.findOne({
				// 				mediaId: content.fileName.toUpperCase()
				// 			})
				// 			// If media object not found, then...
				// 			if (!mediaObject) {
				// 				newStatus = RundownAPI.LineItemStatusCode.SOURCE_MISSING
				// 				// All VT content should have at least two streams
				// 			} else if (mediaObject && mediaObject.mediainfo && mediaObject.mediainfo.streams.length < 2) {
				// 				newStatus = RundownAPI.LineItemStatusCode.SOURCE_BROKEN
				// 			} else if (mediaObject) {
				// 				newStatus = RundownAPI.LineItemStatusCode.OK
				// 			}

				// 			if (mediaObject) {
				// 				metadata = mediaObject
				// 			}
				// 		}
				// 		break
				// }
				if (status !== props.segmentLineItem.status || metadata) {
					let segmentCopy = (_.clone(overrides.segmentLineItem || props.segmentLineItem) as SegmentLineItemUi)

					segmentCopy.status = status
					segmentCopy.metadata = metadata

					overrides.segmentLineItem = _.extend(overrides.segmentLineItem || {}, segmentCopy)
				}
			} else {
				console.error(`SegmentLineItem "${props.segmentLineItem._id}" has no sourceLayer:`, props.segmentLineItem)
			}

			this.forceUpdate()
		})
		// this.statusComp.onInvalidate(() => {
		// 	console.log(`Invalidated "${this.props.segmentLineItem._id}"...`)
		// })
		// this.statusComp.onStop(() => {
		// 	console.log(`Stopping "${this.props.segmentLineItem._id}...`)
		// })
	}

	componentDidMount () {
		Meteor.defer(() => {
			this.updateMediaObjectSubscription()
			this.updateDataTracker()
		})
	}

	componentDidUpdate (prevProps: IPropsHeader) {
		Meteor.defer(() => {
			this.updateMediaObjectSubscription()
		})
		if (this.shouldDataTrackerUpdate(prevProps)) {
			// console.log('Invalidating computation!', this.statusComp.stopped, this.statusComp.invalidated)
			if (this.statusComp) this.statusComp.invalidate()
		}
	}

	componentWillUnmount () {
		super.componentWillUnmount()
	}

	render () {
		return (
			<SourceLayerItem {...this.props} {...this.overrides} />
		)
	}
}
