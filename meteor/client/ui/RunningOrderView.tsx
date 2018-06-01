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
import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'
import { SegmentLine, SegmentLines } from '../../lib/collections/SegmentLines'

import { RunningOrderTimingProvider, withTiming, RunningOrderTiming } from './RunningOrderTiming'
import { SegmentTimelineContainer, SegmentLineItemUi, SegmentUi } from './SegmentTimeline/SegmentTimelineContainer'
import { SegmentContextMenu } from './SegmentTimeline/SegmentContextMenu'
import { InspectorDrawer } from './InspectorDrawer/InspectorDrawer'

import { getCurrentTime } from '../../lib/lib'
import { RundownUtils } from '../lib/rundown'

import * as mousetrap from 'mousetrap'

interface IKeyboardFocusMarkerState {
	inFocus: boolean
}

class KeyboardFocusMarker extends React.Component<any, IKeyboardFocusMarkerState> {
	keyboardFocusInterval: number

	constructor (props) {
		super(props)

		this.state = {
			inFocus: true
		}
	}

	componentDidMount () {
		this.keyboardFocusInterval = Meteor.setInterval(this.checkFocus, 3000)
		$(document.body).on('focusin mousedown focus', this.checkFocus)
	}

	componentWillUnmount () {
		Meteor.clearInterval(this.keyboardFocusInterval)
		$(document.body).off('focusin mousedown focus', this.checkFocus)
	}

	checkFocus = () => {
		const focusNow = document.hasFocus()
		if (this.state.inFocus !== focusNow) {
			this.setState({
				inFocus: focusNow
			})
		}
	}

	render () {
		if (this.state.inFocus) {
			return null
		} else {
			return (
				<div className='running-order-view__focus-lost-frame'></div>
			)
		}
	}
}

interface IHeaderProps {
	runningOrder: RunningOrder
}

interface ITimerHeaderProps extends IHeaderProps {
}

enum RunningOrderViewKbdShortcuts {
	RUNNING_ORDER_TAKE = 'f12',
	RUNNING_ORDER_ACTIVATE = 'f2',
	RUNNING_ORDER_DEACTIVATE = 'ctrl+shift+f2'
}

const TimingDisplay = translate()(withTiming()(class extends React.Component<ITimerHeaderProps & InjectedTranslateProps & RunningOrderTiming.InjectedROTimingProps> {
	render () {
		const { t } = this.props

		return (
			<div className='timing mod'>
				<span className='timing-clock-header-label'>{t('Now')}: </span>
				<span className='timing-clock time-now'><Moment format='HH:mm:ss' date={getCurrentTime()} /></span>
				<span className={ClassNames('timing-clock heavy-light', {
					'heavy': (this.props.timingDurations.asPlayedRundownDuration || 0) > (this.props.timingDurations.totalRundownDuration || 0),
					'light': (this.props.timingDurations.asPlayedRundownDuration || 0) < (this.props.timingDurations.totalRundownDuration || 0)
				})}>
					{RundownUtils.formatDiffToTimecode((this.props.timingDurations.totalRundownDuration || 0) - (this.props.timingDurations.asPlayedRundownDuration || 0), true)}
				</span>
				<span className='timing-clock-header-label'>{t('Finish')}: </span>
				<span className='timing-clock time-end'><Moment format='HH:mm:ss' date={getCurrentTime() + ((this.props.timingDurations.remainingRundownDuration || 0))} /></span>
			</div>
		)
	}
}))

class RunningOrderHeader extends React.Component<IHeaderProps> {
	componentDidMount () {
		mousetrap.bind(RunningOrderViewKbdShortcuts.RUNNING_ORDER_TAKE, this.keyTake)
		mousetrap.bind(RunningOrderViewKbdShortcuts.RUNNING_ORDER_ACTIVATE, this.keyActivate)
		mousetrap.bind(RunningOrderViewKbdShortcuts.RUNNING_ORDER_DEACTIVATE, this.keyDeactivate)
	}

	componentWillUnmount () {
		mousetrap.unbind(RunningOrderViewKbdShortcuts.RUNNING_ORDER_TAKE)
		mousetrap.unbind(RunningOrderViewKbdShortcuts.RUNNING_ORDER_ACTIVATE)
		mousetrap.unbind(RunningOrderViewKbdShortcuts.RUNNING_ORDER_DEACTIVATE)
	}

	keyTake = (e: ExtendedKeyboardEvent) => {
		e.preventDefault()
		e.stopImmediatePropagation()
		e.stopPropagation()
		this.take()
	}

	keyActivate = (e: ExtendedKeyboardEvent) => {
		this.activate()
	}

	keyDeactivate = (e: ExtendedKeyboardEvent) => {
		this.deactivate()
	}

	take = () => {
		Meteor.call('playout_take', this.props.runningOrder._id)
		console.log(new Date(getCurrentTime()))
	}

	activate = () => {
		Meteor.call('playout_activate', this.props.runningOrder._id)
	}

	deactivate = () => {
		Meteor.call('playout_inactivate', this.props.runningOrder._id)
	}

	render () {
		return (
			<div className='header running-order'>
				<div className='row'>
					<div className='col c4 super-dark'>
						{/* !!! TODO: This is just a temporary solution !!! */}
						<div className='right' style={{
							'marginTop': '0.9em'
						}}>
							<button className='btn btn-secondary btn-compact aciton reload-data' onClick={(e) => Meteor.call('playout_reload_data', this.props.runningOrder._id)}>
								Reload data
							</button>
							{
								(this.props.runningOrder && (this.props.runningOrder.active ?
									<React.Fragment>
										<button className='btn btn-secondary btn-compact aciton activate-deactivate deactivate' onClick={(e) => this.deactivate()}>
											Deactivate
										</button>
										<button className='btn btn-secondary btn-compact aciton take' onClick={(e) => this.take()}>
											Take
										</button>
									</React.Fragment>
									: <React.Fragment>
										<button className='btn btn-secondary btn-compact aciton activate-deactivate activate' onClick={(e) => this.activate()}>
											Activate
										</button>
									</React.Fragment>
								))
							}
						</div>
						<div className='badge mod'>
							<div className='media-elem mrs sofie-logo' />
							<div className='bd mls'><span className='logo-text'>Sofie</span></div>
						</div>
					</div>
					<div className='col c4 super-dark'>
						<TimingDisplay {...this.props} />
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
	}
}

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
	bottomMargin: string
}

export const RunningOrderView = translate()(withTracker((props, state) => {
	let subRunningOrders = Meteor.subscribe('runningOrders', {})
	let subSegments = Meteor.subscribe('segments', {})
	let subSegmentLines = Meteor.subscribe('segmentLines', {})
	let subSegmentLineItems = Meteor.subscribe('segmentLineItems', {})
	let subStudioInstallations = Meteor.subscribe('studioInstallations', {})
	let subShowStyles = Meteor.subscribe('showStyles', {})
	let subSegmentLineAdLibItems = Meteor.subscribe('segmentLineAdLibItems', {})

	let runningOrderId = decodeURIComponent(props.match.params.runningOrderId)

	let runningOrder = RunningOrders.findOne({ _id: runningOrderId })
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
			timeScale: 0.05,
			studioMode: localStorage.getItem('studioMode') === '1' ? true : false,
			contextMenuContext: null,
			bottomMargin: ''
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

	onChangeBottomMargin = (newBottomMargin: string) => {
		this.setState({
			bottomMargin: newBottomMargin
		})
	}

	getStyle () {
		return {
			'marginBottom': this.state.bottomMargin
		}
	}

	render () {
		const { t } = this.props

		return (
			<RunningOrderTimingProvider
				runningOrder={this.props.runningOrder}>
				<div className='running-order-view' style={this.getStyle()}>
					<KeyboardFocusMarker />
					<RunningOrderHeader
						runningOrder={this.props.runningOrder} />
					<SegmentContextMenu
						contextMenuContext={this.state.contextMenuContext}
						runningOrder={this.props.runningOrder}
						onSetNext={this.onSetNext} />
					{this.renderSegmentsList()}
					<InspectorDrawer {...this.props}
						onChangeBottomMargin={this.onChangeBottomMargin} />
				</div>
			</RunningOrderTimingProvider>
		)
	}
}
))
