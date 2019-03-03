/*
Please note that the contents of this file is quite unstructured and for test purposes only
*/

import * as React from 'react'
import * as _ from 'underscore'
import { withTracker, translateWithTracker, Translated } from '../lib/ReactMeteorData/react-meteor-data'

import { RunningOrders, RunningOrder } from '../../lib/collections/RunningOrders'
import { Segments, Segment } from '../../lib/collections/Segments'
import { Timeline, TimelineObjGeneric } from '../../lib/collections/Timeline'
import { TimelineState, TriggerType } from 'superfly-timeline'
import { SegmentLines, SegmentLine } from '../../lib/collections/SegmentLines'
import { MediaObjects, MediaObject } from '../../lib/collections/MediaObjects'
import { Resolver, Enums } from 'superfly-timeline'
import { transformTimeline } from '../../lib/timeline'
import { Time, getCurrentTime } from '../../lib/lib'
import { getCurrentTimeReactive } from '../lib/currentTimeReactive'
import { makeTableOfObject } from '../lib/utilComponents'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { StudioInstallations, StudioInstallation } from '../../lib/collections/StudioInstallations'
import Script from 'react-load-script'
import { loadScript } from '../lib/lib'

// ----------------------------------------------------------------------------
interface ITimelineVisualizerProps {

}
interface ITimelineVisualizerState {
	studioId: string

}
interface ITimelineVisualizerTrackedProps {
	studios: Array<StudioInstallation>
}

export const TimelineVisualizerView = translateWithTracker<ITimelineVisualizerProps, ITimelineVisualizerState, ITimelineVisualizerTrackedProps>((props: ITimelineVisualizerProps) => {
	return {
		studios: StudioInstallations.find({}).fetch()
	}
})(class TimelineVisualizerView extends MeteorReactComponent<Translated<ITimelineVisualizerProps & ITimelineVisualizerTrackedProps>, ITimelineVisualizerState> {
	constructor (props) {
		super(props)
		this.state = {
			studioId: '',
		}
	}
	componentWillMount () {
		this.subscribe('studioInstallations', {})
	}
	onClickStudio = (studio) => {
		this.setState({
			studioId: studio._id
		})
	}
	render () {
		const { t } = this.props

		return (
			<div className='mhl gutter timeline-visualizer'>
				<header className='mbs'>
					<h1>{t('')}</h1>
				</header>
				<div className='mod mvl'>
					<strong>Timeline visualizer</strong>
					<ul>

						{
							_.map(this.props.studios, (studio) => {
								return (
									<li key={studio._id}>
										<a href='#' onClick={() => this.onClickStudio(studio)}>{studio.name}</a>
									</li>
								)
							})
						}
					</ul>
				</div>
				<div>
					{
						this.state.studioId ?
						<TimelineVisualizerInStudio studioId={this.state.studioId} />
						: null
					}
				</div>
			</div>
		)
	}
})

interface ITimelineVisualizerInStudioProps {
	studioId: string
}
interface ITimelineVisualizerInStudioState {
	scriptLoaded?: boolean
	scriptError?: boolean
}
interface ITimelineVisualizerInStudioTrackedProps {
	timeline: Array<TimelineObjGeneric>
}
export const TimelineVisualizerInStudio = translateWithTracker<ITimelineVisualizerInStudioProps, ITimelineVisualizerInStudioState, ITimelineVisualizerInStudioTrackedProps>((props: ITimelineVisualizerInStudioProps) => {
	return {
		timeline: Timeline.find({
			siId: props.studioId
		}).fetch()
	}
})(
class TimelineVisualizerInStudio extends MeteorReactComponent<Translated<ITimelineVisualizerInStudioProps & ITimelineVisualizerInStudioTrackedProps>, ITimelineVisualizerInStudioState> {
	private startVisualizer: boolean = false
	private newTimeline: TimelineObjGeneric[] | null = null
	private visualizer: any = null

	constructor (props) {
		super(props)
		this.state = {
			scriptLoaded: false,
			scriptError: false
		}
	}
	componentWillMount () {
		this.subscribe('timeline', {
			siId: this.props.studioId
		})

		this.triggerLoadScript()

	}
	componentDidUpdate () {
		if (this.startVisualizer) {
			// @ts-ignore temporary implementation
			const TimelineVisualizer: any = window.TimelineVisualizer
			if (!this.visualizer) {
				// initialize
				this.visualizer = new TimelineVisualizer.TimelineVisualizer('timeline-visualizer', {
					drawPlayhead: true,
				})

				// @ts-ignore
				window.visualizer = this.visualizer
				this.visualizer.setViewPort({
					playSpeed: 1000,

					playViewPort: true,
					playPlayhead: true,
					playheadTime: getCurrentTime(),
					timestamp: getCurrentTime(),
					zoom: 10 * 1000,
				})
			}
			if (this.newTimeline) {
				this.visualizer.updateTimeline(this.newTimeline, {

				})
				this.newTimeline = null
			}
		}
	}
	triggerLoadScript () {
		loadScript('/scripts/timeline-visualizer.min.js', (err) => {
			this.setState({
				scriptLoaded: !err,
				scriptError: !!err
			})
		})
	}
	renderTimeline () {
		this.startVisualizer = true

		let timeline = _.compact(_.map(this.props.timeline, (obj) => {

			let o = _.extend({
				id: obj._id
			}, obj)
			delete o._id

			if (o.trigger.value === 'now') o.trigger.value = getCurrentTime() // tmp

			if (o.id) return convertTimelineObject(o) // Note: this is a temporary conversion. When we've moved to timeline v2 this can be removed.
		}))

		this.newTimeline = timeline

		return (
			<div>
				<canvas width='1280' height='1080' id='timeline-visualizer'></canvas>
			</div>
		)
	}
	render () {
		const { t } = this.props

		return (
			<div>
				{/* <script src='/script/timeline-visualizer.js'></script> */}
				<div>studio: {this.props.studioId}</div>
				<div>timeline objects: {this.props.timeline.length}</div>
				<div>
					{
						this.state.scriptLoaded ?
							this.renderTimeline() :
						this.state.scriptError ?
							<div>'Unable to load script'</div> :
						null
					}
				</div>
			</div>
		)
	}
})

/**
 * Note: this is a temporary function, which converts a timelineObject of the OLD type to the new (v2)
 * @param obj
 */
function convertTimelineObject (obj: any): any {
	const newObj: any = {
		id: obj.id,
		enable: {
		},
		layer: obj.LLayer,
		// children?: Array<TimelineObject>
		// keyframes?: Array<TimelineKeyframe>
		classes: obj.classes,
		disabled: obj.disabled,
		isGroup: obj.isGroup,
		priority: obj.priority,
		content: obj.content
	}

	if (obj.trigger.type === TriggerType.TIME_ABSOLUTE) {
		newObj.enable.start = obj.trigger.value
	} else if (obj.trigger.type === TriggerType.TIME_RELATIVE) {
		newObj.enable.start = obj.trigger.value
	} else if (obj.trigger.type === TriggerType.LOGICAL) {
		newObj.enable.while = obj.trigger.value
		// if (newObj.enable.while === '1') {
		// 	newObj.enable.while = 'true'
		// } else if (newObj.enable.while === '0') {
		// 	newObj.enable.while = 'false'
		// }
	}
	if (obj.duration) {
		newObj.enable.duration = obj.duration
	}
	// @ts-ignore
	if (obj.legacyRepeatingTime) {
		// @ts-ignore
		newObj.enable.repeating = obj.legacyRepeatingTime
	}
	// @ts-ignore
	if (obj.legacyEndTime) {
		// @ts-ignore
		newObj.enable.end = obj.legacyEndTime
	}
	if (obj.content.keyframes) {
		newObj.keyframes = []
		_.each(obj.content.keyframes, (kf: any) => {
			newObj.keyframes.push(convertTimelineKeyframe(kf))
		})
		delete obj.content.keyframes
	}
	if (obj.isGroup && obj.content.objects) {
		newObj.isGroup = true
		newObj.children = []
		_.each(obj.content.objects, (obj: any) => {
			newObj.children.push(convertTimelineObject(obj))
		})
		delete obj.content.objects
	}
	return newObj
}
function convertTimelineKeyframe (obj: any): any {
	const newKf: any = {
		id: obj.id,
		enable: {
		},
		// children?: Array<TimelineObject>
		// keyframes?: Array<TimelineKeyframe>
		classes: obj.classes,
		// disabled: boolean
		content: obj.content
	}
	if (obj.trigger.type === TriggerType.TIME_ABSOLUTE) {
		newKf.enable.start = obj.trigger.value
	} else if (obj.trigger.type === TriggerType.TIME_RELATIVE) {
		newKf.enable.start = obj.trigger.value
	} else if (obj.trigger.type === TriggerType.LOGICAL) {
		newKf.enable.while = obj.trigger.value
	}
	if (obj.duration) {
		newKf.enable.duration = obj.duration
	}
	return newKf
}

// export class TimelineVisualizer extends MeteorReactComponent<INPProps> {
// 	componentWillMount () {
// 		// Subscribe to data:
// 		this.autorun(() => {
// 			this.subscribe('timeline', {})

// 			/*
// 			this.subscribe('runningOrders', {
// 				active: true
// 			})
// 			this.subscribe('studioInstallations', {})
// 			this.subscribe('showStyleBases', {})
// 			this.subscribe('showStyleVariants', {})
// 			let activeRO = RunningOrders.findOne({active: true})
// 			if (activeRO) {
// 				this.subscribe('segments', {
// 					runningOrderId: activeRO._id
// 				})
// 				this.subscribe('segmentLines', {
// 					runningOrderId: activeRO._id
// 				})
// 				this.subscribe('segmentLineItems', {
// 					runningOrderId: activeRO._id
// 				})
// 				this.subscribe('segmentLineAdLibItems', {
// 					runningOrderId: activeRO._id
// 				})
// 			}
// 			*/
// 		})
// 	}
// 	render () {
// 		return (
// 			<div>
// 				<h1>Timeline visualizer</h1>
// 				<div>

// 				</div>
// 			</div>
// 		)
// 	}
// }
