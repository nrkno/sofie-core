import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import * as _ from 'underscore'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { Studio, Studios } from '../../../lib/collections/Studios'
import { Link } from 'react-router-dom'
import { TimelineObjGeneric, Timeline } from '../../../lib/collections/Timeline'
import { TriggerType } from 'superfly-timeline'
import { getCurrentTime } from '../../../lib/lib'
import { loadScript } from '../../lib/lib'
import { PubSub } from '../../../lib/api/pubsub'

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
	if (newObj.isGroup && !newObj.children) {
		newObj.children = []
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

interface ITimelineViewProps {
	match?: {
		params?: {
			studioId: string
		}
	}
}
interface ITimelineViewState {
}
const TimelineView = translateWithTracker<ITimelineViewProps, ITimelineViewState, {}>((props: ITimelineViewProps) => {
	return {
		studios: Studios.find({}).fetch()
	}
})(class TimelineView extends MeteorReactComponent<Translated<ITimelineViewProps>, ITimelineViewState> {

	constructor (props: Translated<ITimelineViewProps>) {
		super(props)
	}

	render () {
		const { t } = this.props

		// console.log('obj', obj)
		return (
			<div className='mtl gutter'>
				<header className='mvs'>
					<h1>{t('Timeline')}</h1>
				</header>
				<div className='mod mvl'>
					{this.props.match && this.props.match.params && <TimelineVisualizerInStudio studioId={this.props.match.params.studioId}/>}
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
	showDetails: any
}
interface ITimelineVisualizerInStudioTrackedProps {
	timeline: Array<TimelineObjGeneric>
}
export const TimelineVisualizerInStudio = translateWithTracker<ITimelineVisualizerInStudioProps, ITimelineVisualizerInStudioState, ITimelineVisualizerInStudioTrackedProps>((props: ITimelineVisualizerInStudioProps) => {
	return {
		timeline: Timeline.find({
			studioId: props.studioId
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
			scriptError: false,
			showDetails: null
		}
	}
	componentDidMount () {
		this.subscribe(PubSub.timeline, {
			studioId: this.props.studioId
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
				this.visualizer.on('timeline:mouseDown', (event) => {
					if (event.detail) {
						this.setState({
							showDetails: event.detail
						})
					}
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
	closeDetails () {
		this.setState({
			showDetails: null
		})
	}
	renderTimeline () {
		this.startVisualizer = true

		let timeline = _.compact(_.map(this.props.timeline, (obj) => {

			let o = _.clone(obj)
			delete o._id

			if (o.trigger.value === 'now') o.trigger.value = getCurrentTime() // tmp

			if (o.id) return convertTimelineObject(o) // Note: this is a temporary conversion. When we've moved to timeline v2 this can be removed.
		}))

		this.newTimeline = timeline

		return (
			<div>
				<canvas width='1280' height='3000' id='timeline-visualizer'></canvas>
			</div>
		)
	}
	render () {

		return (
			<div className='timeline-visualizer'>
				{/* <script src='/script/timeline-visualizer.js'></script> */}
				<div>Studio: {this.props.studioId}</div>
				<div>Timeline objects: {this.props.timeline.length}</div>
				<div className='timeline'>
					{
						this.state.scriptLoaded ?
							this.renderTimeline() :
						this.state.scriptError ?
							<div>'Unable to load script'</div> :
						null
					}
				</div>
				<div className='details'>
					{
						this.state.showDetails ?
						<div className='content'>
							<button className='btn btn-secondary btn-tight' onClick={() => this.closeDetails()}>Close</button>
							<pre>
								{JSON.stringify(this.state.showDetails, null, 2)}
							</pre>
						</div> : null
					}
				</div>
			</div>
		)
	}
})

interface IStudioSelectProps {
}
interface IStudioSelectState {
}
interface IStudioSelectTrackedProps {
	studios: Studio[]
}
const TimelineStudioSelect = translateWithTracker<IStudioSelectProps, IStudioSelectState, IStudioSelectTrackedProps>((props: IStudioSelectProps) => {
	return {
		studios: Studios.find({}, {
			sort: {
				_id: 1
			}
		}).fetch()
	}
})(class StudioSelection extends MeteorReactComponent<Translated<IStudioSelectProps & IStudioSelectTrackedProps>, IStudioSelectState> {
	render () {
		const { t } = this.props

		return (
			<div className='mhl gutter recordings-studio-select'>
				<header className='mbs'>
					<h1>{t('Timeline')}</h1>
				</header>
				<div className='mod mvl'>
					<strong>Studio</strong>
					<ul>

						{
							_.map(this.props.studios, (studio) => {
								return (
									<li key={studio._id}>
										<Link to={`timeline/${studio._id}`}>{studio.name}</Link>
									</li>
								)
							})
						}
					</ul>
				</div>
			</div>
		)
	}
})

export { TimelineView, TimelineStudioSelect }
