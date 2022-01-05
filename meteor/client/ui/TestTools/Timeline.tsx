import * as React from 'react'
import { Translated, translateWithTracker, withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import * as _ from 'underscore'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { deserializeTimelineBlob } from '../../../lib/collections/Timeline'
import { Time, applyToArray, clone } from '../../../lib/lib'
import { PubSub } from '../../../lib/api/pubsub'
import { TimelineState, Resolver, ResolvedStates } from 'superfly-timeline'
import { transformTimeline } from '@sofie-automation/corelib/dist/playout/timeline'
import { getCurrentTimeReactive } from '../../lib/currentTimeReactive'
import { StudioSelect } from './StudioSelect'
import { StudioId } from '../../../lib/collections/Studios'
import { Mongo } from 'meteor/mongo'
import { RoutedTimeline } from '../../../lib/collections/Timeline'

const StudioTimeline = new Mongo.Collection<RoutedTimeline>('studioTimeline')

interface ITimelineViewProps {
	match?: {
		params?: {
			studioId: StudioId
		}
	}
}
interface ITimelineViewState {}
const TimelineView = translateWithTracker<ITimelineViewProps, ITimelineViewState, {}>((_props: ITimelineViewProps) => {
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
								<ComponentTimelineSimulate studioId={this.props.match.params.studioId} />
							</div>
						)}
					</div>
				</div>
			)
		}
	}
)

interface ITimelineSimulateProps {
	studioId: StudioId
}
interface ITimelineSimulateTrackedProps {
	errorMsg?: string
	allStates?: ResolvedStates
	now: Time
}
interface ITimelineSimulateState {
	time: Time | null
}
export const ComponentTimelineSimulate = withTracker<
	ITimelineSimulateProps,
	ITimelineSimulateState,
	ITimelineSimulateTrackedProps
>((props: ITimelineSimulateProps) => {
	const now = getCurrentTimeReactive()

	try {
		// These properties will be exposed under this.props
		// Note that these properties are reactively recalculated
		const tlComplete = StudioTimeline.findOne(props.studioId)
		const timelineObj = tlComplete && deserializeTimelineBlob(tlComplete.timelineBlob)
		console.log('regen timeline', tlComplete?.timelineHash, tlComplete?.generated)
		const timeline =
			(tlComplete &&
				timelineObj &&
				timelineObj
					.map((o) => {
						const obj = clone(o)
						applyToArray(o.enable, (enable) => {
							if (enable.start === 'now') {
								enable.start = now
							}
						})
						return obj
					})
					.sort((a, b) => {
						if (a.id > b.id) {
							return 1
						}
						if (a.id < b.id) {
							return -1
						}
						return 0
					})) ||
			[]
		const transformed = transformTimeline(timeline)

		// TODO - dont repeat unless changed
		const tl = Resolver.resolveTimeline(transformed, { time: tlComplete?.generated || now })
		const allStates = Resolver.resolveAllStates(tl)

		return {
			now: now,
			allStates: allStates,
			timelineUpdated: tlComplete?.generated || null,
		}
	} catch (e) {
		return {
			now: now,
			errorMsg: `Failed to update timeline:\n${e}`,
			timelineUpdated: null,
		}
	}
})(
	class ComponentTimelineSimulate extends MeteorReactComponent<
		ITimelineSimulateProps & ITimelineSimulateTrackedProps,
		ITimelineSimulateState
	> {
		constructor(props: ITimelineSimulateProps & ITimelineSimulateTrackedProps) {
			super(props)

			this.state = {
				time: null,
			}
		}
		componentDidMount() {
			this.subscribe(PubSub.timelineForStudio, this.props.studioId)
		}
		renderTimelineState(state: TimelineState) {
			return _.map(
				_.sortBy(_.values(state.layers), (o) => o.layer),
				(o) => (
					<tr key={o.layer}>
						<td>{o.layer}</td>
						<td style={{ maxWidth: '25vw', minWidth: '10vw', overflowWrap: 'anywhere' }}>{o.id}</td>
						<td style={{ whiteSpace: 'pre', maxWidth: '15vw', overflowX: 'auto' }}>
							{JSON.stringify(o.enable, undefined, '\t')}
						</td>
						<td>
							Start: {o.instance.start}
							<br />
							End: {o.instance.end}
						</td>
						<td>{o.content.type}</td>
						<td>{(o.classes || []).join('<br />')}</td>
						<td style={{ whiteSpace: 'pre' }}>{JSON.stringify(o.content, undefined, '\t')}</td>
					</tr>
				)
			)
		}
		render() {
			const state = this.props.allStates
				? Resolver.getState(this.props.allStates, this.state.time ?? this.props.now)
				: undefined

			const times = _.uniq((this.props.allStates?.nextEvents ?? []).map((e) => e.time))

			return (
				<div>
					<h2>Timeline state</h2>
					<p>
						Time:{' '}
						<select
							onChange={(e) => {
								const val = Number(e.target.value)
								this.setState({ time: isNaN(val) ? null : val })
							}}
							value={this.state.time ?? 'now'}
						>
							<option id="now">Now: {this.props.now}</option>
							{times.map((e) => (
								<option id={e + ''} key={e}>
									{e}
								</option>
							))}
						</select>
					</p>

					<div>
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
											<th>Instance Times</th>
											<th>type</th>
											<th>classes</th>
											<th>content</th>
										</tr>
										{state ? this.renderTimelineState(state) : ''}
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
