import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { translate } from 'react-i18next'
import * as CoreIcon from '@nrk/core-icons/jsx'
import { Spinner } from '../lib/Spinner'
import * as ClassNames from 'classnames'
import * as $ from 'jquery'
import * as _ from 'underscore'
import Moment from 'react-moment'

import { NavLink } from 'react-router-dom'

import { PlayoutAPI } from '../../lib/api/playout'
import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { Segment, Segments } from '../../lib/collections/Segments'
import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'
import { SegmentLine } from '../../lib/collections/SegmentLines'

import { ContextMenu, MenuItem, ContextMenuTrigger } from 'react-contextmenu'

import { RunningOrderTimingProvider, withTiming, WithTiming } from './RunningOrderTiming'
import { SegmentTimelineContainer } from './SegmentTimeline/SegmentTimelineContainer'
import { SegmentContextMenu } from './SegmentTimeline/SegmentContextMenu'
import { InspectorDrawer } from './InspectorDrawer/InspectorDrawer'
import { RunningOrderOverview } from './RunningOrderOverview'

import { getCurrentTime } from '../../lib/lib'
import { RundownUtils } from '../lib/rundown'

import * as mousetrap from 'mousetrap'
import { ErrorBoundary } from './ErrorBoundary'

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

interface ITimingDisplayProps {
	runningOrder: RunningOrder
}
interface ITimingDisplayState {
}

enum RunningOrderViewKbdShortcuts {
	RUNNING_ORDER_TAKE = 'f12',
	RUNNING_ORDER_TAKE2 = 'enter', // is only going to use the rightmost enter key for take
	RUNNING_ORDER_ACTIVATE = '§',
	RUNNING_ORDER_ACTIVATE2 = '\\',
	RUNNING_ORDER_ACTIVATE3 = '|',
	RUNNING_ORDER_ACTIVATE_REHEARSAL = 'mod+§',
	RUNNING_ORDER_DEACTIVATE = 'mod+shift+§',
	RUNNING_ORDER_GO_TO_LIVE = 'mod+home'
}
mousetrap.addKeycodes({
	220: '§',
	222: '\\',
	223: '|'
})

const TimingDisplay = translate()(withTiming<ITimingDisplayProps, ITimingDisplayState>()(
class extends React.Component<Translated<WithTiming<ITimingDisplayProps>>, ITimingDisplayState> {
	render () {
		const { t } = this.props

		if (!this.props.runningOrder) return null

		return (
			<div className='timing mod'>
				{this.props.runningOrder.startedPlayback ?
					<span className='timing-clock plan-start left'>
						<span className='timing-clock-label left'>{t('Started')}</span>
						<Moment interval={0} format='HH:mm:ss' date={this.props.runningOrder.startedPlayback} />
					</span> :
					<span className='timing-clock plan-start left'>
						<span className='timing-clock-label left'>{t('Planned start')}</span>
						<Moment interval={0} format='HH:mm:ss' date={this.props.runningOrder.expectedStart} />
					</span>
				}
				{ this.props.runningOrder.startedPlayback ?
					this.props.runningOrder.expectedStart &&
						<span className='timing-clock countdown playback-started left'>
							<span className='timing-clock-label left hide-overflow' title={this.props.runningOrder.name}>{this.props.runningOrder.name}</span>
							{RundownUtils.formatDiffToTimecode(this.props.runningOrder.startedPlayback - this.props.runningOrder.expectedStart, true, true, true)}
						</span>
					:
					this.props.runningOrder.expectedStart &&
						<span className={ClassNames('timing-clock countdown plan-start left', {
							'heavy': getCurrentTime() > this.props.runningOrder.expectedStart
						})}>
							<span className='timing-clock-label left hide-overflow' title={this.props.runningOrder.name}>{this.props.runningOrder.name}</span>
							{RundownUtils.formatDiffToTimecode(getCurrentTime() - this.props.runningOrder.expectedStart, true, true, true)}
						</span>
				}
				<span className='timing-clock time-now'><Moment interval={0} format='HH:mm:ss' date={getCurrentTime()} /></span>
				{ this.props.runningOrder.expectedDuration ?
					(<React.Fragment>
						{this.props.runningOrder.expectedStart && this.props.runningOrder.expectedDuration &&
							<span className='timing-clock plan-end right visual-last-child'>
								<span className='timing-clock-label right'>{t('Planned end')}</span>
								<Moment interval={0} format='HH:mm:ss' date={this.props.runningOrder.expectedStart + this.props.runningOrder.expectedDuration} />
							</span>
						}
						{this.props.runningOrder.expectedStart && this.props.runningOrder.expectedDuration &&
							<span className='timing-clock countdown plan-end right'>
								{RundownUtils.formatDiffToTimecode(getCurrentTime() - (this.props.runningOrder.expectedStart + this.props.runningOrder.expectedDuration), true, true, true)}
							</span>
						}
						{this.props.runningOrder.expectedDuration &&
							<span className={ClassNames('timing-clock heavy-light right', {
								'heavy': (this.props.timingDurations.asPlayedRundownDuration || 0) > (this.props.runningOrder.expectedDuration || 0),
								'light': (this.props.timingDurations.asPlayedRundownDuration || 0) < (this.props.runningOrder.expectedDuration || 0)
							})}>
								<span className='timing-clock-label right'>{t('Diff')}</span>
								{RundownUtils.formatDiffToTimecode(this.props.runningOrder.expectedDuration - (this.props.timingDurations.asPlayedRundownDuration || 0), true, true, true)}
							</span>
						}
					</React.Fragment>) :
					(<React.Fragment>
						{this.props.timingDurations ?
							<span className='timing-clock plan-end right visual-last-child'>
								<span className='timing-clock-label right'>{t('Expected end')}</span>
								<Moment interval={0} format='HH:mm:ss' date={getCurrentTime() + (this.props.timingDurations.totalRundownDuration || 0)} />
							</span> :
							null
						}
						{this.props.timingDurations ?
							<span className={ClassNames('timing-clock heavy-light right', {
								'heavy': (this.props.timingDurations.asPlayedRundownDuration || 0) > (this.props.timingDurations.totalRundownDuration || 0),
								'light': (this.props.timingDurations.asPlayedRundownDuration || 0) < (this.props.timingDurations.totalRundownDuration || 0)
							})}>
								<span className='timing-clock-label right'>{t('Diff')}</span>
								{RundownUtils.formatDiffToTimecode((this.props.timingDurations.totalRundownDuration || 0) - (this.props.timingDurations.asPlayedRundownDuration || 0), true, true, true)}
							</span> :
							null
						}
					</React.Fragment>)
				}
			</div>
		)
	}
}))
interface IRunningOrderHeaderProps {
	runningOrder: RunningOrder,
	onActivate?: (isRehearsal: boolean) => void
}

const RunningOrderHeader = translate()(class extends React.Component<Translated<IRunningOrderHeaderProps>> {
	bindKeys: Array<{
		key: string,
		up?: (e: KeyboardEvent) => any
		down?: (e: KeyboardEvent) => any
	}> = []
	constructor (props: Translated<IRunningOrderHeaderProps>) {
		super(props)

		this.bindKeys = [
			{
				key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_TAKE,
				up: this.keyTake
			},{
				key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_TAKE2,
				up: this.keyTake
			},{
				key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_ACTIVATE,
				up: this.keyActivate
			},{
				key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_ACTIVATE2,
				up: this.keyActivate
			},{
				key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_ACTIVATE3,
				up: this.keyActivate
			},{
				key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_DEACTIVATE,
				up: this.keyDeactivate
			},{
				key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_ACTIVATE_REHEARSAL,
				up: this.keyActivateRehearsal
			},
		]
	}
	componentDidMount () {
		// $(document).on("keydown", function(e) {
		// 	console.log(e)
		// })

		let preventDefault = (e) => {
			e.preventDefault()
			e.stopImmediatePropagation()
			e.stopPropagation()
		}
		_.each(this.bindKeys, (k) => {
			if (k.up) {
				mousetrap.bind(k.key, (e: KeyboardEvent) => {
					preventDefault(e)
					if (k.up) k.up(e)
				}, 'keyup')
				mousetrap.bind(k.key, (e: KeyboardEvent) => {
					preventDefault(e)
				}, 'keydown')
			}
			if (k.down) {
				mousetrap.bind(k.key, (e: KeyboardEvent) => {
					preventDefault(e)
					if (k.down) k.down(e)
				}, 'keydown')
			}
		})
	}

	componentWillUnmount () {
		_.each(this.bindKeys, (k) => {
			if (k.up) {
				mousetrap.unbind(k.key, 'keyup')
				mousetrap.unbind(k.key, 'keydown')
			}
			if (k.down) {
				mousetrap.unbind(k.key, 'keydown')
			}
		})
	}
	keyTake = (e: ExtendedKeyboardEvent) => {
		if (e.key !== 'Enter' || e.location === 3) { // only allow the rightmost enter key
			this.take()
		}
	}
	keyActivate = (e: ExtendedKeyboardEvent) => {
		this.activate()
	}
	keyActivateRehearsal = (e: ExtendedKeyboardEvent) => {
		this.activateRehearsal()
	}

	keyDeactivate = (e: ExtendedKeyboardEvent) => {
		this.deactivate()
	}

	take = () => {
		Meteor.call(PlayoutAPI.methods.roTake, this.props.runningOrder._id)
		// console.log(new Date(getCurrentTime()))
	}

	activate = () => {
		if (!this.props.runningOrder.active) {
			Meteor.call(PlayoutAPI.methods.roActivate, this.props.runningOrder._id, false)
			if (typeof this.props.onActivate === 'function') this.props.onActivate(false)
		}
	}

	activateRehearsal = () => {
		if (!this.props.runningOrder.active) {
			Meteor.call(PlayoutAPI.methods.roActivate, this.props.runningOrder._id, true)
			if (typeof this.props.onActivate === 'function') this.props.onActivate(true)
		}
	}

	deactivate = () => {
		if (this.props.runningOrder.active) {
			Meteor.call(PlayoutAPI.methods.roDeactivate, this.props.runningOrder._id)
		}
	}

	reloadRunningOrder = () => {
		Meteor.call(PlayoutAPI.methods.reloadData, this.props.runningOrder._id)
	}
	getHeaderClassNames = () => {
		return (
			'header running-order' +
			(this.props.runningOrder.active ? ' active' : ' not-active') +
			(this.props.runningOrder.rehearsal ? ' rehearsal' : '')
		)
	}

	render () {
		const { t } = this.props
		return (
			<div className={this.getHeaderClassNames()}>
				<div className='row first-row super-dark'>
					<div className='flex-col left horizontal-align-left'>
						{/* !!! TODO: This is just a temporary solution !!! */}
						<div className='badge mod'>
							<div className='media-elem mrs sofie-logo' />
							<div className='bd mls'><span className='logo-text'>Sofie</span></div>
						</div>
					</div>
					<div className='flex-col right horizontal-align-right'>
						<div className='links mod close'>
							<NavLink to='/runningOrders'>
								<CoreIcon id='nrk-close' />
							</NavLink>
						</div>
					</div>
					<ContextMenu id='running-order-context-menu'>
						<div className='react-contextmenu-label'>
							{this.props.runningOrder && this.props.runningOrder.name}
						</div>
						{
							this.props.runningOrder && this.props.runningOrder.active ?
								<React.Fragment>
									<MenuItem onClick={(e) => this.deactivate()}>
										{t('Deactivate')}
									</MenuItem>
									<MenuItem onClick={(e) => this.take()}>
										{t('Take')}
									</MenuItem>
								</React.Fragment> :
								<React.Fragment>
									<MenuItem onClick={(e) => this.activate()}>
										{t('Activate')}
									</MenuItem>
									<MenuItem onClick={(e) => this.activateRehearsal()}>
										{t('Activate (Rehearsal)')}
									</MenuItem>
								</React.Fragment>
						}
						<MenuItem onClick={(e) => this.reloadRunningOrder()}>
							{t('Reload running order')}
						</MenuItem>
					</ContextMenu>
					<ContextMenuTrigger id='running-order-context-menu' attributes={{
						className: 'flex-col col-timing horizontal-align-center'
					}}>
						<TimingDisplay {...this.props} />
					</ContextMenuTrigger>
				</div>
				<div className='row dark'>
					<div className='col c12 running-order-overview'>
						{this.props.runningOrder && <RunningOrderOverview runningOrderId={this.props.runningOrder._id} /> }
					</div>
				</div>
			</div>
		)
	}
})

interface IProps {
	key: string
	match: {
		params: {
			runningOrderId: string
		}
	}
}

interface IState {
	timeScale: number
	studioMode: boolean
	contextMenuContext: any
	bottomMargin: string
	followLiveSegments: boolean
}

interface ITrackedProps {
	runningOrder?: RunningOrder
	segments: Array<Segment>
	studioInstallation?: StudioInstallation
}
export const RunningOrderView = translateWithTracker<IProps, IState, ITrackedProps>((props: IProps, state) => {

	let runningOrderId = decodeURIComponent(props.match.params.runningOrderId)

	let runningOrder = RunningOrders.findOne({ _id: runningOrderId })
	// let roDurations = calculateDurations(runningOrder, segmentLines)
	return {
		runningOrder: runningOrder,
		segments: runningOrder ? Segments.find({ runningOrderId: runningOrder._id }, {
			sort: {
				'_rank': 1
			}
		}).fetch() : [],
		studioInstallation: runningOrder ? StudioInstallations.findOne({ _id: runningOrder.studioInstallationId }) : undefined,
	}
})(
class extends React.Component<Translated<IProps & ITrackedProps>, IState> {

	private _subscriptions: Array<Meteor.SubscriptionHandle> = []
	private bindKeys: Array<{
		key: string,
		up?: (e: KeyboardEvent) => any
		down?: (e: KeyboardEvent) => any
	}> = []

	constructor (props: Translated<IProps & ITrackedProps>) {
		super(props)

		this.state = {
			timeScale: 0.05,
			studioMode: localStorage.getItem('studioMode') === '1' ? true : false,
			contextMenuContext: null,
			bottomMargin: '',
			followLiveSegments: true
		}

		this.bindKeys = [
			{
				key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_GO_TO_LIVE,
				up: this.onGoToLiveSegment
			}
		]
	}

	componentWillMount () {
		// Subscribe to data:
		let runningOrderId = this.props.match.params.runningOrderId

		this._subscriptions.push(Meteor.subscribe('runningOrders', {
			_id: runningOrderId
		}))
		this._subscriptions.push(Meteor.subscribe('segments', {
			runningOrderId: runningOrderId
		}))
		this._subscriptions.push(Meteor.subscribe('segmentLines', {
			runningOrderId: runningOrderId
		}))
		this._subscriptions.push(Meteor.subscribe('segmentLineItems', {
			runningOrderId: runningOrderId
		}))
		this._subscriptions.push(Meteor.subscribe('studioInstallations', {
			runningOrderId: runningOrderId
		}))
		this._subscriptions.push(Meteor.subscribe('showStyles', {
			runningOrderId: runningOrderId
		}))
		this._subscriptions.push(Meteor.subscribe('segmentLineAdLibItems', {
			runningOrderId: runningOrderId
		}))
	}
	componentDidMount () {
		$(document.body).addClass('dark')
		$(window).on('scroll', this.onWindowScroll)
		let preventDefault = (e) => {
			e.preventDefault()
			e.stopImmediatePropagation()
			e.stopPropagation()
		}
		_.each(this.bindKeys, (k) => {
			if (k.up) {
				mousetrap.bind(k.key, (e: KeyboardEvent) => {
					preventDefault(e)
					if (k.up) k.up(e)
				}, 'keyup')
				mousetrap.bind(k.key, (e: KeyboardEvent) => {
					preventDefault(e)
				}, 'keydown')
			}
			if (k.down) {
				mousetrap.bind(k.key, (e: KeyboardEvent) => {
					preventDefault(e)
					if (k.down) k.down(e)
				}, 'keydown')
			}
		})
	}
	componentWillUnmount () {
		$(document.body).removeClass('dark')
		$(window).off('scroll', this.onWindowScroll)

		_.each(this._subscriptions, (sub ) => {
			sub.stop()
		})

		_.each(this.bindKeys, (k) => {
			if (k.up) {
				mousetrap.unbind(k.key, 'keyup')
				mousetrap.unbind(k.key, 'keydown')
			}
			if (k.down) {
				mousetrap.unbind(k.key, 'keydown')
			}
		})
	}

	onTimeScaleChange = (timeScaleVal) => {
		if (Number.isFinite(timeScaleVal) && timeScaleVal > 0) {
			this.setState({
				timeScale: timeScaleVal
			})
		}
	}

	onSegmentScroll = () => {
		if (this.state.followLiveSegments && this.props.runningOrder && this.props.runningOrder.active) {
			this.setState({
				followLiveSegments: false
			})
		}
	}

	onWindowScroll = (e: JQuery.Event) => {
		const isAutoScrolling = $(document.body).hasClass('auto-scrolling')
		if (this.state.followLiveSegments && !isAutoScrolling && this.props.runningOrder && this.props.runningOrder.active) {
			this.setState({
				followLiveSegments: false
			})
		}
	}

	onGoToLiveSegment = () => {
		this.setState({
			followLiveSegments: true
		})
	}

	onActivate = (isRehearsal: boolean) => {
		this.setState({
			followLiveSegments: true
		})
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
		if (segmentLine && segmentLine._id && this.props.runningOrder) {
			Meteor.call(PlayoutAPI.methods.roSetNext, this.props.runningOrder._id, segmentLine._id)
		}
	}

	renderSegments () {
		if (this.props.segments) {
			return this.props.segments.map((segment) => {
				if (this.props.studioInstallation && this.props.runningOrder) {
					return <ErrorBoundary key={segment._id}>
							<SegmentTimelineContainer
												studioInstallation={this.props.studioInstallation}
												followLiveSegments={this.state.followLiveSegments}
												segment={segment}
												runningOrder={this.props.runningOrder}
												liveLineHistorySize={100}
												timeScale={this.state.timeScale}
												onTimeScaleChange={this.onTimeScaleChange}
												onContextMenu={this.onContextMenu}
												onSegmentScroll={this.onSegmentScroll}
												/>
						</ErrorBoundary>
				}
			})
		} else {
			return (
				<div></div>
			)
		}
	}

	renderSegmentsList () {
		const { t } = this.props

		if (this.props.runningOrder) {
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

		if (this.props.runningOrder && this.props.studioInstallation) {
			return (
				<RunningOrderTimingProvider
					runningOrder={this.props.runningOrder}>
					<div className='running-order-view' style={this.getStyle()}>
						<ErrorBoundary>
							<KeyboardFocusMarker />
						</ErrorBoundary>
						<ErrorBoundary>
							<RunningOrderHeader
								runningOrder={this.props.runningOrder}
								onActivate={this.onActivate} />
						</ErrorBoundary>
						<ErrorBoundary>
							<SegmentContextMenu
								contextMenuContext={this.state.contextMenuContext}
								runningOrder={this.props.runningOrder}
								onSetNext={this.onSetNext} />
						</ErrorBoundary>
						{this.renderSegmentsList()}
						{!this.state.followLiveSegments &&
							<div className='running-order-view__go-to-onAir' onClick={this.onGoToLiveSegment}>ON AIR</div>
						}
						<ErrorBoundary>
							<InspectorDrawer
								segments={this.props.segments}
								runningOrder={this.props.runningOrder}
								studioInstallation={this.props.studioInstallation}
								onChangeBottomMargin={this.onChangeBottomMargin} />
						</ErrorBoundary>
					</div>
				</RunningOrderTimingProvider>
			)
		} else {
			return null
		}
	}
}
)
