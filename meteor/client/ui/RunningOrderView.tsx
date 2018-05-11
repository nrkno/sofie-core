import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { translate, InjectedTranslateProps } from 'react-i18next'
import * as CoreIcon from '@nrk/core-icons/jsx'
import { Spinner } from '../lib/Spinner'

import * as ClassNames from 'classnames'
import * as $ from 'jquery'
import { Time } from '../../lib/lib'
import Moment from 'react-moment'
import timer from 'react-timer-hoc'
import { parse as queryStringParse } from 'query-string'

import { NavLink } from 'react-router-dom'

import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { Segment, Segments } from '../../lib/collections/Segments'
import { SegmentTimelineContainer, SegmentLineItemUi, SegmentUi } from './SegmentTimeline/SegmentTimelineContainer'
import { SegmentContextMenu } from './SegmentTimeline/SegmentContextMenu'
import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'
import { SegmentLine, SegmentLines } from '../../lib/collections/SegmentLines'
import { getCurrentTime } from '../../lib/lib'
import { RundownUtils } from '../lib/rundown'

interface IHeaderProps {
	debugOnAirLine: () => void
	runningOrder: RunningOrder
}

interface ITimerHeaderProps extends IHeaderProps {
	totalRundownDuration: number
	remainingRundownDuration: number
	asPlayedRundownDuration: number
}

const TimingDisplay = translate()(withTracker((props, state) => {
	const calculateDurations = (runningOrder: RunningOrder, segmentLines: Array<SegmentLine>) => {
		const durations = {
			expected: 0,
			remaining: 0,
			asPlayed: 0
		}

		segmentLines.forEach((item) => {
			// expected is just a sum of expectedDurations
			durations.expected += item.expectedDuration || 0

			// asPlayed is the actual duration so far and expected durations in unplayed lines
			// item is onAir right now, and it's already taking longer than rendered/expectedDuration
			if (item.startedPlayback && !item.duration && runningOrder.currentSegmentLineId === item._id && item.startedPlayback + (item.expectedDuration || 0) < (getCurrentTime() / 1000)) {
				durations.asPlayed += ((getCurrentTime() / 1000) - item.startedPlayback)
			} else {
				durations.asPlayed += (item.duration || item.expectedDuration || 0)
			}

			// remaining is the sum of unplayed lines + whatever is left of the current segment
			if (!item.startedPlayback) {
				durations.remaining += item.expectedDuration || 0
				// item is onAir right now, and it's is currently shorter than expectedDuration
			} else if (item.startedPlayback && !item.duration && runningOrder.currentSegmentLineId === item._id && item.startedPlayback + (item.expectedDuration || 0) > (getCurrentTime() / 1000)) {
				durations.remaining += (item.expectedDuration || 0) - ((getCurrentTime() / 1000) - item.startedPlayback)
			}
		})

		console.log(durations)

		return durations
	}

	// let runningOrder = RunningOrders.findOne({ _id: props.match.params.runningOrderId })
	// let roDurations = calculateDurations(runningOrder, segmentLines)
	let totalRundownDuration = 0
	let remainingRundownDuration = 0
	let asPlayedRundownDuration = 0

	if (props.runningOrder) {
		const segmentLines = SegmentLines.find({ 'runningOrderId': props.runningOrder._id }).fetch()
	
		if (segmentLines) {
			const d = calculateDurations(props.runningOrder, segmentLines)
			totalRundownDuration = d.expected
			remainingRundownDuration = d.remaining
			asPlayedRundownDuration = d.asPlayed
		}
	}

	return {
		totalRundownDuration,
		remainingRundownDuration,
		asPlayedRundownDuration
	}
})(timer(250)(class extends React.Component<IHeaderProps & InjectedTranslateProps> {
	render () {
		const { t } = this.props

		return (
			<div className='timing mod'>
				<span className='timing-clock-header-label'>{t('Now')}: </span>
				<span className='timing-clock time-now'><Moment format='HH:mm:ss' date={getCurrentTime()} /></span>
				<span className='timing-clock heavy-light heavy'>-00:15</span>
				<span className='timing-clock-header-label'>{t('Finish')}: </span>
				<span className='timing-clock time-end'><Moment format='HH:mm:ss' date={getCurrentTime() + (this.props.remainingRundownDuration * 1000)} /></span>
			</div>
		)
	}
})))

const RunningOrderHeader: React.SFC<IHeaderProps> = (props) => (
	<div className='header running-order'>
		<div className='row'>
			<div className='col c4 super-dark'>
				{/* !!! TODO: This is just a temporary solution !!! */}
				<div className='right' style={{
					'marginTop': '0.9em'
				}}>
					<button className='btn btn-secondary btn-compact' onClick={(e) => Meteor.call('debug_demoRundown')}>
						Last inn kjøreplan
					</button>

					<button className='btn btn-secondary btn-compact' onClick={(e) => Meteor.call('debug_takeNext', props.runningOrder._id)}>
						Take
					</button>
				</div>
				<div className='badge mod'>
					<div className='media-elem mrs sofie-logo' />
					<div className='bd mls'><span className='logo-text'>Sofie</span></div>
				</div>
			</div>
			<div className='col c4 super-dark'>
				<TimingDisplay {...props} />
			</div>
			<div className='flex-col c4 super-dark horizontal-align-right'>
				<div className='links mod close'>
					<NavLink to='/runningOrders'>
						<CoreIcon id='nrk-close' />
					</NavLink>
				</div>
			</div>
		</div>
		<div className='row'>
			<div className='col c12 running-order-overview'>
				<img src='/mock_runningOrder_overview.png' />
			</div>
		</div>
	</div>
)

interface IPropsHeader extends InjectedTranslateProps {
	key: string
	runningOrder: RunningOrder
	segments: Array<Segment>
	studioInstallation: StudioInstallation
	match: {
		runningOrderId: String
	}
}

interface IStateHeader {
	timeScale: number
	studioMode: boolean
	contextMenuContext: any
}

export const RunningOrderView = translate()(withTracker((props, state) => {
	let subRunningOrders = Meteor.subscribe('runningOrders', {})
	let subSegments = Meteor.subscribe('segments', {})
	let subSegmentLines = Meteor.subscribe('segmentLines', {})
	let subSegmentLineItems = Meteor.subscribe('segmentLineItems', {})
	let subStudioInstallations = Meteor.subscribe('studioInstallations', {})
	let subShowStyles = Meteor.subscribe('showStyles', {})

	let runningOrder = RunningOrders.findOne({ _id: props.match.params.runningOrderId })
	// let roDurations = calculateDurations(runningOrder, segmentLines)

	return {
		runningOrder: runningOrder,
		segments: runningOrder ? Segments.find({ runningOrderId: runningOrder._id }, {
			sort: {
				'_rank': 1
			}
		}).fetch() : undefined,
		studioInstallation: runningOrder ? StudioInstallations.findOne({ _id: runningOrder.studioInstallationId }) : undefined,
	}
})(
class extends React.Component<IPropsHeader, IStateHeader> {
	constructor (props) {
		super(props)

		this.state = {
			timeScale: 50,
			studioMode: localStorage.getItem('studioMode') === '1' ? true : false,
			contextMenuContext: null
		}
	}

	componentDidMount () {
		$(document.body).addClass('dark')
	}

	componentWillUnmount () {
		$(document.body).removeClass('dark')
	}

	onTimeScaleChange = (timeScaleVal) => {
		if (Number.isFinite(timeScaleVal) && timeScaleVal > 0) {
			this.setState({
				timeScale: timeScaleVal
			})
		}
	}

	totalRundownDuration () {
		return 0
	}

	onContextMenu = (contextMenuContext: any) => {
		this.setState({
			contextMenuContext
		})
	}

	onSetNext = (segmentLine: SegmentLine) => {
		if (segmentLine && segmentLine._id) {
			Meteor.call('debug_setNextLine', segmentLine._id)
		}
	}

	renderSegments () {
		if (this.props.segments !== undefined && this.props.studioInstallation !== undefined) {
			return this.props.segments.map((segment) => (
				<SegmentTimelineContainer key={segment._id}
										  studioInstallation={this.props.studioInstallation}
										  segment={segment}
										  runningOrder={this.props.runningOrder}
										  liveLineHistorySize='100'
										  timeScale={this.state.timeScale}
										  onTimeScaleChange={this.onTimeScaleChange}
										  onContextMenu={this.onContextMenu}
										  />
			))
		} else {
			return (
				<div></div>
			)
		}
	}

	renderSegmentsList () {
		const { t } = this.props

		if (this.props.runningOrder !== undefined) {
			return (
				<div>
					{this.renderSegments()}
				</div>
			)
		} else {
			return (
				<div className='mod'>
					<Spinner />
				</div>
			)
		}
	}

	render () {
		const { t } = this.props

		return (
			<div className='running-order-view'>
				<RunningOrderHeader debugOnAirLine={this.debugOnAirLine} runningOrder={this.props.runningOrder} />
				<SegmentContextMenu contextMenuContext={this.state.contextMenuContext}
					onSetNext={this.onSetNext} />
				{this.renderSegmentsList()}
			</div>
		)
	}
}
))
