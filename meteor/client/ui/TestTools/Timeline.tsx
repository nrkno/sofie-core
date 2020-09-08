import * as React from 'react'
import { Translated, translateWithTracker, withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import * as _ from 'underscore'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { TimelineObjGeneric, Timeline } from '../../../lib/collections/Timeline'
import { getCurrentTime, Time } from '../../../lib/lib'
import { loadScript } from '../../lib/lib'
import { PubSub } from '../../../lib/api/pubsub'
import { TimelineState, Resolver } from 'superfly-timeline'
import { transformTimeline } from '../../../lib/timeline'
import { getCurrentTimeReactive } from '../../lib/currentTimeReactive'
import { makeTableOfObject } from '../../lib/utilComponents'
import { StudioSelect } from './StudioSelect'
import { StudioId } from '../../../lib/collections/Studios'

interface ITimelineViewProps {
	match?: {
		params?: {
			studioId: StudioId
		}
	}
}
interface ITimelineViewState {}
const TimelineView = translateWithTracker<ITimelineViewProps, ITimelineViewState, {}>((props: ITimelineViewProps) => {
	return {}
})(
	class TimelineView extends MeteorReactComponent<Translated<ITimelineViewProps>, ITimelineViewState> {
		constructor(props: Translated<ITimelineViewProps>) {
			super(props)
		}

		render() {
			const { t } = this.props

			return (
				<div className="mtl gutter">
					<header className="mvs">
						<h1>{t('Timeline')}</h1>
					</header>
					<div className="mod mvl">
						{this.props.match && this.props.match.params && (
							<div>
								<TimelineVisualizerInStudio studioId={this.props.match.params.studioId} />
								<ComponentTimelineSimulate studioId={this.props.match.params.studioId} />
							</div>
						)}
					</div>
				</div>
			)
		}
	}
)

interface ITimelineVisualizerInStudioProps {
	studioId: StudioId
}
interface ITimelineVisualizerInStudioState {
	scriptLoaded?: boolean
	scriptError?: boolean
	showDetails: any
	errorMsg?: string
}
interface ITimelineVisualizerInStudioTrackedProps {
	timeline: Array<TimelineObjGeneric>
}
export const TimelineVisualizerInStudio = translateWithTracker<
	ITimelineVisualizerInStudioProps,
	ITimelineVisualizerInStudioState,
	ITimelineVisualizerInStudioTrackedProps
>((props: ITimelineVisualizerInStudioProps) => {
	const findMeATimeline = Timeline.findOne({
		_id: props.studioId,
	})
	return {
		timeline: (findMeATimeline && findMeATimeline.timeline) || [],
	}
})(
	class TimelineVisualizerInStudio extends MeteorReactComponent<
		Translated<ITimelineVisualizerInStudioProps & ITimelineVisualizerInStudioTrackedProps>,
		ITimelineVisualizerInStudioState
	> {
		private startVisualizer: boolean = false
		private newTimeline: TimelineObjGeneric[] | null = null
		private visualizer: any = null

		constructor(props) {
			super(props)
			this.state = {
				scriptLoaded: false,
				scriptError: false,
				showDetails: null,
			}
		}
		componentDidMount() {
			this.subscribe(PubSub.timeline, {
				_id: this.props.studioId,
			})

			this.triggerLoadScript()
		}
		componentDidUpdate() {
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
								showDetails: event.detail,
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
					try {
						this.visualizer.updateTimeline(this.newTimeline, {})
						this.newTimeline = null
						if (this.state.errorMsg) {
							this.setState({
								errorMsg: undefined,
							})
						}
					} catch (e) {
						const msg = `Failed to update timeline:\n${e}`
						this.newTimeline = null
						if (msg !== this.state.errorMsg) {
							this.setState({
								errorMsg: msg,
							})
						}
					}
				}
			}
		}
		triggerLoadScript() {
			loadScript('/scripts/timeline-visualizer.js', (err) => {
				this.setState({
					scriptLoaded: !err,
					scriptError: !!err,
				})
			})
		}
		closeDetails() {
			this.setState({
				showDetails: null,
			})
		}
		renderTimeline() {
			this.startVisualizer = true

			let timeline = _.compact(
				_.map(this.props.timeline, (obj) => {
					let o = _.clone(obj)
					delete o._id

					if (o.enable.start === 'now') o.enable.start = getCurrentTime() // tmp

					return o
				})
			)

			this.newTimeline = timeline

			return (
				<div>
					<canvas width="1280" height="3000" id="timeline-visualizer"></canvas>
				</div>
			)
		}
		render() {
			return (
				<div className="timeline-visualizer">
					{/* <script src='/script/timeline-visualizer.js'></script> */}
					<div>Studio: {this.props.studioId}</div>
					<div>Timeline objects: {this.props.timeline.length}</div>
					{this.state.errorMsg ? <div>{this.state.errorMsg}</div> : ''}
					<div className="timeline">
						{this.state.scriptLoaded ? (
							this.renderTimeline()
						) : this.state.scriptError ? (
							<div>'Unable to load script'</div>
						) : null}
					</div>
					<div className="details">
						{this.state.showDetails ? (
							<div className="content">
								<button className="btn btn-secondary btn-tight" onClick={() => this.closeDetails()}>
									Close
								</button>
								<pre>{JSON.stringify(this.state.showDetails, null, 2)}</pre>
							</div>
						) : null}
					</div>
				</div>
			)
		}
	}
)

interface ITimelineSimulateProps {
	studioId: StudioId
}
interface ITimelineSimulateState {
	errorMsg?: string
	state?: TimelineState
	now: Time
}
export const ComponentTimelineSimulate = withTracker<ITimelineSimulateProps, {}, ITimelineSimulateState>(
	(props: ITimelineSimulateProps) => {
		let now = getCurrentTimeReactive()

		try {
			// These properties will be exposed under this.props
			// Note that these properties are reactively recalculated
			const tlComplete = Timeline.findOne(props.studioId)
			const timeline =
				(tlComplete &&
					tlComplete.timeline.sort((a, b) => {
						if (a._id > b._id) {
							return 1
						}
						if (a._id < b._id) {
							return -1
						}
						return 0
					})) ||
				[]
			const transformed = transformTimeline(timeline)

			// TODO - dont repeat unless changed
			let tl = Resolver.resolveTimeline(transformed, { time: now })
			let allStates = Resolver.resolveAllStates(tl)

			let state = Resolver.getState(allStates, now)

			return {
				now: now,
				state: state,
			}
		} catch (e) {
			return {
				now: now,
				errorMsg: `Failed to update timeline:\n${e}`,
			}
		}
	}
)(
	class ComponentTimelineSimulate extends MeteorReactComponent<ITimelineSimulateProps & ITimelineSimulateState> {
		renderTimelineState(state: TimelineState) {
			return _.map(
				_.sortBy(_.values(state.layers), (o) => o.layer),
				(o) => (
					<tr key={o.layer}>
						<td>{o.layer}</td>
						<td>{o.id}</td>
						<td>{makeTableOfObject(o.enable)}</td>
						<td>{o.instance.end ? o.instance.end - o.instance.start : ''}</td>
						<td>{o.content.type}</td>
						<td>{makeTableOfObject(o.classes || [])}</td>
						<td>{makeTableOfObject(o.content)}</td>
					</tr>
				)
			)
		}
		render() {
			return (
				<div>
					<h2>Timeline state</h2>
					<div>
						Time: {this.props.now}
						{this.props.errorMsg ? (
							<p>{this.props.errorMsg}</p>
						) : (
							<div>
								<table className="testtools-timelinetable">
									<tbody>
										<tr>
											<th>Layer</th>
											<th>id</th>
											<th>Enable</th>
											<th>Duration</th>
											<th>type</th>
											<th>classes</th>
											<th>content</th>
										</tr>
										{this.props.state ? this.renderTimelineState(this.props.state) : ''}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</div>
			)
		}
	}
)

class TimelineStudioSelect extends React.Component<{}, {}> {
	render() {
		return <StudioSelect path="timeline" title="Timeline" />
	}
}

export { TimelineView, TimelineStudioSelect }
