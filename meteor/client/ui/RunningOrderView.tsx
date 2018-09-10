import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { translate } from 'react-i18next'
import timer from 'react-timer-hoc'
import * as CoreIcon from '@nrk/core-icons/jsx'
import { Spinner } from '../lib/Spinner'
import * as ClassNames from 'classnames'
import * as $ from 'jquery'
import * as _ from 'underscore'
import Moment from 'react-moment'

import { NavLink, Route } from 'react-router-dom'

import { ClientAPI } from '../../lib/api/client'
import { PlayoutAPI } from '../../lib/api/playout'
import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { Segment, Segments } from '../../lib/collections/Segments'
import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'
import { SegmentLine } from '../../lib/collections/SegmentLines'

import { ContextMenu, MenuItem, ContextMenuTrigger } from 'react-contextmenu'

import { RunningOrderTimingProvider, withTiming, WithTiming } from './RunningOrderView/RunningOrderTiming'
import { SegmentTimelineContainer } from './SegmentTimeline/SegmentTimelineContainer'
import { SegmentContextMenu } from './SegmentTimeline/SegmentContextMenu'
import { InspectorDrawer } from './InspectorDrawer/InspectorDrawer'
import { RunningOrderOverview } from './RunningOrderView/RunningOrderOverview'
import { RunningOrderSystemStatus } from './RunningOrderView/RunningOrderSystemStatus'

import { getCurrentTime } from '../../lib/lib'
import { RundownUtils } from '../lib/rundown'

import * as mousetrap from 'mousetrap'
import { ErrorBoundary } from '../lib/ErrorBoundary'
import { ModalDialog } from '../lib/ModalDialog'
import { DEFAULT_DISPLAY_DURATION } from '../../lib/RunningOrder'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { getStudioMode, getDeveloperMode } from '../lib/localStorage'
import { scrollToSegmentLine } from '../lib/viewPort'

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

interface ITimingWarningProps {
	runningOrder: RunningOrder
	inActiveROView?: boolean
	studioMode: boolean
	onReloadAndActivate: () => void
}

interface ITimingWarningState {
	plannedStartCloseShown?: boolean
	plannedStartCloseShow?: boolean
}

const WarningDisplay = translate()(timer(5000)(
	class extends React.Component<Translated<ITimingWarningProps>, ITimingWarningState> {
		private REHEARSAL_MARGIN = 1 * 60 * 1000

		constructor (props) {
			super(props)

			this.state = {}
		}

		componentDidUpdate (prevProps: ITimingWarningProps) {
			if ((this.props.runningOrder.active && !prevProps.runningOrder.active && this.props.runningOrder.rehearsal) ||
				(this.props.runningOrder.rehearsal !== prevProps.runningOrder.rehearsal)) {
				this.setState({
					plannedStartCloseShown: false
				})
			}

			if (this.props.runningOrder.active && this.props.runningOrder.rehearsal && this.props.runningOrder.expectedStart &&
				// the expectedStart is near
				getCurrentTime() + this.REHEARSAL_MARGIN > this.props.runningOrder.expectedStart &&
				// but it's not horribly in the past
				getCurrentTime() < this.props.runningOrder.expectedStart + (this.props.runningOrder.expectedDuration || 60 * 60 * 1000) &&
				!this.props.inActiveROView && !this.state.plannedStartCloseShown) {

				this.setState({
					plannedStartCloseShow: true,
					plannedStartCloseShown: true
				})
			}
		}

		discard = () => {
			this.setState({
				plannedStartCloseShow: false
			})
		}

		reloadRO = () => {
			this.setState({
				plannedStartCloseShow: false
			})

			this.props.onReloadAndActivate()
		}

		render () {
			const { t } = this.props

			if (!this.props.runningOrder) return null

			return <ModalDialog title={t('Start time is close')} acceptText={t('Yes')} secondaryText={t('No')} onAccept={this.reloadRO} onDiscard={this.discard} onSecondary={this.discard} show={this.props.studioMode && this.state.plannedStartCloseShow && !(this.props.runningOrder.active && !this.props.runningOrder.rehearsal) && this.props.runningOrder.active}>
						<p>{t('You are in rehearsal mode, the broadcast starts in 1 minute. Do you want to reload the rundown and remove rehearsal mode?')}</p>
					</ModalDialog>
		}
	}
) as React.StatelessComponent<Translated<ITimingWarningProps>>)

interface ITimingDisplayProps {
	runningOrder: RunningOrder
}

export enum RunningOrderViewKbdShortcuts {
	RUNNING_ORDER_TAKE = 'f12',
	RUNNING_ORDER_TAKE2 = 'enter', // is only going to use the rightmost enter key for take
	RUNNING_ORDER_HOLD = 'h',
	RUNNING_ORDER_ACTIVATE = '§',
	RUNNING_ORDER_ACTIVATE2 = '\\',
	RUNNING_ORDER_ACTIVATE3 = '|',
	RUNNING_ORDER_ACTIVATE_REHEARSAL = 'mod+§',
	RUNNING_ORDER_DEACTIVATE = 'mod+shift+§',
	RUNNING_ORDER_GO_TO_LIVE = 'mod+home',
	RUNNING_ORDER_REWIND_SEGMENTS = 'shift+home',
	RUNNING_ORDER_RELOAD_RUNNING_ORDER = 'mod+shift+f12',
	RUNNING_ORDER_TOGGLE_DRAWER = 'tab',
	ADLIB_QUEUE_MODIFIER = 'shift',
	RUNNING_ORDER_NEXT_FORWARD = 'f9',
	RUNNING_ORDER_NEXT_DOWN = 'f10',
	RUNNING_ORDER_NEXT_BACK = 'shift+f9',
	RUNNING_ORDER_NEXT_UP = 'shift+f10',
	RUNNING_ORDER_DISABLE_NEXT_ELEMENT = 'g',
	RUNNING_ORDER_UNDO_DISABLE_NEXT_ELEMENT = 'shift+g',
	RUNNING_ORDER_RESET_FOCUS = 'esc'
}
mousetrap.addKeycodes({
	220: '§', // on US-based (ANSI) keyboards (single-row, Enter key), this is the key above Enter, usually with a backslash and the vertical pipe character
	222: '\\', // on ANSI-based keyboards, this is the key with single quote
	223: '|' // this key is not present on ANSI-based keyboards
})

const TimingDisplay = translate()(withTiming<ITimingDisplayProps, {}>()(
class extends React.Component<Translated<WithTiming<ITimingDisplayProps>>> {
	render () {
		const { t } = this.props

		if (!this.props.runningOrder) return null

		return (
			<div className='timing mod'>
				{ this.props.runningOrder.startedPlayback && (this.props.runningOrder.active && !this.props.runningOrder.rehearsal) ?
					<span className='timing-clock plan-start left'>
						<span className='timing-clock-label left'>{t('Started')}</span>
						<Moment interval={0} format='HH:mm:ss' date={this.props.runningOrder.startedPlayback} />
					</span> :
					<span className='timing-clock plan-start left'>
						<span className='timing-clock-label left'>{t('Planned start')}</span>
						<Moment interval={0} format='HH:mm:ss' date={this.props.runningOrder.expectedStart} />
					</span>
				}
				{ this.props.runningOrder.startedPlayback && (this.props.runningOrder.active && !this.props.runningOrder.rehearsal) ?
					this.props.runningOrder.expectedStart &&
						<span className='timing-clock countdown playback-started left'>
							<span className='timing-clock-label left hide-overflow rundown-name' title={this.props.runningOrder.name}>{this.props.runningOrder.name}</span>
							{RundownUtils.formatDiffToTimecode(this.props.runningOrder.startedPlayback - this.props.runningOrder.expectedStart, true, false, true, true, true)}
						</span>
					:
					this.props.runningOrder.expectedStart &&
						<span className={ClassNames('timing-clock countdown plan-start left', {
							'heavy': getCurrentTime() > this.props.runningOrder.expectedStart
						})}>
							<span className='timing-clock-label left hide-overflow rundown-name' title={this.props.runningOrder.name}>{this.props.runningOrder.name}</span>
							{RundownUtils.formatDiffToTimecode(getCurrentTime() - this.props.runningOrder.expectedStart, true, false, true, true, true)}
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
								'heavy': (this.props.timingDurations.asPlayedRundownDuration || 0) < (this.props.runningOrder.expectedDuration || 0),
								'light': (this.props.timingDurations.asPlayedRundownDuration || 0) > (this.props.runningOrder.expectedDuration || 0)
							})}>
								<span className='timing-clock-label right'>{t('Diff')}</span>
								{RundownUtils.formatDiffToTimecode((this.props.timingDurations.asPlayedRundownDuration || 0) - this.props.runningOrder.expectedDuration, true, false, true, true, true, undefined, true)}
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
								'heavy': (this.props.timingDurations.asPlayedRundownDuration || 0) < (this.props.timingDurations.totalRundownDuration || 0),
								'light': (this.props.timingDurations.asPlayedRundownDuration || 0) > (this.props.timingDurations.totalRundownDuration || 0)
							})}>
								<span className='timing-clock-label right'>{t('Diff')}</span>
								{RundownUtils.formatDiffToTimecode((this.props.timingDurations.asPlayedRundownDuration || 0) - (this.props.timingDurations.totalRundownDuration || 0), true, false, true, true, true, undefined, true)}
							</span> :
							null
						}
					</React.Fragment>)
				}
			</div>
		)
	}
}))

interface HotkeyDefinition {
	key: string
	label: string
}

interface IRunningOrderHeaderProps {
	runningOrder: RunningOrder,
	studioInstallation: StudioInstallation,
	onActivate?: (isRehearsal: boolean) => void,
	onRegisterHotkeys?: (hotkeys: Array<HotkeyDefinition>) => void
	studioMode: boolean
	inActiveROView?: boolean
}

interface IRunningOrderHeaderState {
	isError: boolean,
	errorMessage?: string
}

const RunningOrderHeader = translate()(class extends React.Component<Translated<IRunningOrderHeaderProps>, IRunningOrderHeaderState> {
	bindKeys: Array<{
		key: string,
		up?: (e: KeyboardEvent) => any
		down?: (e: KeyboardEvent) => any
		label: string
		global?: boolean
	}> = []
	constructor (props: Translated<IRunningOrderHeaderProps>) {
		super(props)

		const { t } = props
		if (this.props.studioMode) {
			this.bindKeys = [
				{
					key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_TAKE,
					up: this.keyTake,
					label: t('Take'),
					global: true
				},{
					key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_TAKE2,
					up: this.keyTake,
					label: t('Take'),
					global: true
				},{
					key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_HOLD,
					up: this.keyHold,
					label: t('Hold')
				},{
					key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_ACTIVATE,
					up: this.keyActivate,
					label: t('Activate'),
					global: true
				},{
					key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_ACTIVATE2,
					up: this.keyActivate,
					label: t('Activate'),
					global: true
				},{
					key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_ACTIVATE3,
					up: this.keyActivate,
					label: t('Activate'),
					global: true
				},{
					key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_DEACTIVATE,
					up: this.keyDeactivate,
					label: t('Deactivate'),
					global: true
				},{
					key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_ACTIVATE_REHEARSAL,
					up: this.keyActivateRehearsal,
					label: t('Activate (Rehearsal)'),
					global: true
				},{
					key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_RELOAD_RUNNING_ORDER,
					up: this.keyReloadRunningOrder,
					label: t('Reload running order'),
					global: true
				},{
					key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_NEXT_FORWARD,
					up: this.keyMoveNextForward,
					label: t('Move Next forwards'),
					global: true
				},
				{
					key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_NEXT_DOWN,
					up: this.keyMoveNextDown,
					label: t('Move Next to the following segment'),
					global: true
				},
				{
					key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_NEXT_UP,
					up: this.keyMoveNextUp,
					label: t('Move Next to the previous segment'),
					global: true
				},
				{
					key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_NEXT_BACK,
					up: this.keyMoveNextBack,
					label: t('Move Next backwards'),
					global: true
				},
				{
					key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_DISABLE_NEXT_ELEMENT,
					up: this.keyDisableNextSegmentLineItem,
					label: t('Disable the next element'),
					global: true
				},
				{
					key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_UNDO_DISABLE_NEXT_ELEMENT,
					up: this.keyDisableNextSegmentLineItemUndo,
					label: t('Undo Disable the next element'),
					global: true
				}
			]
		} else {
			this.bindKeys = []
		}
		this.state = {
			isError: false
		}
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
			const method = k.global ? mousetrap.bindGlobal : mousetrap.bind
			if (k.up) {
				method(k.key, (e: KeyboardEvent) => {
					preventDefault(e)
					if (k.up) k.up(e)
				}, 'keyup')
				method(k.key, (e: KeyboardEvent) => {
					preventDefault(e)
				}, 'keydown')
			}
			if (k.down) {
				method(k.key, (e: KeyboardEvent) => {
					preventDefault(e)
					if (k.down) k.down(e)
				}, 'keydown')
			}
		})

		if (typeof this.props.onRegisterHotkeys === 'function') {
			this.props.onRegisterHotkeys(this.bindKeys)
		}
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
	keyHold = (e: ExtendedKeyboardEvent) => {
		this.hold()
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

	keyReloadRunningOrder = (e: ExtendedKeyboardEvent) => {
		this.reloadRunningOrder()
	}
	keyMoveNextForward = (e: ExtendedKeyboardEvent) => {
		// "forward" = to next SegmentLine
		this.moveNext(1, 0)
	}
	keyMoveNextBack = (e: ExtendedKeyboardEvent) => {
		// "down" = to next Segment
		this.moveNext(-1, 0)
	}
	keyMoveNextDown = (e: ExtendedKeyboardEvent) => {
		// "down" = to next Segment
		this.moveNext(0, 1)
	}
	keyMoveNextUp = (e: ExtendedKeyboardEvent) => {
		// "down" = to next Segment
		this.moveNext(0, -1)
	}
	keyDisableNextSegmentLineItem = (e: ExtendedKeyboardEvent) => {
		if (this.props.studioMode) {
			Meteor.call(ClientAPI.methods.execMethod, PlayoutAPI.methods.roDisableNextSegmentLineItem, this.props.runningOrder._id, false, (err, segmentLineItemId) => {
				if (err) {
					// todo: notify the user
					console.log(err)
				} else {
					// console.log('segmentLineItemId', segmentLineItemId)
				}
			})
		}
	}
	keyDisableNextSegmentLineItemUndo = (e: ExtendedKeyboardEvent) => {
		if (this.props.studioMode) {
			Meteor.call(ClientAPI.methods.execMethod, PlayoutAPI.methods.roDisableNextSegmentLineItem, this.props.runningOrder._id, true, (err, segmentLineItemId) => {
				if (err) {
					// todo: notify the user
					console.log(err)
				} else {
					// console.log('segmentLineItemId', segmentLineItemId)
				}
			})
		}
	}

	take = () => {
		if (this.props.studioMode) {
			Meteor.call(ClientAPI.methods.execMethod, PlayoutAPI.methods.roTake, this.props.runningOrder._id)
		}
		// console.log(new Date(getCurrentTime()))
	}
	moveNext = (horisonalDelta: number, verticalDelta: number) => {
		if (this.props.studioMode) {
			Meteor.call(ClientAPI.methods.execMethod, PlayoutAPI.methods.roMoveNext, this.props.runningOrder._id, horisonalDelta, verticalDelta, (err, segmentLineId) => {
				if (err) {
					// todo: notify the user
					console.log(err)
				} else {
					scrollToSegmentLine(segmentLineId)
				}
			})
		}
		// console.log(new Date(getCurrentTime()))
	}

	handleActivationError = (err) => {
		const { t } = this.props
		if (err.error === 409) {
			this.setState({
				isError: true,
				errorMessage: t('Only a single running order can be active in a studio. Deactivate the other running order and try again.')
			})
		}
	}

	discardError = () => {
		this.setState({
			isError: false
		})
	}

	hold = () => {
		if (this.props.studioMode && this.props.runningOrder.active) {
			Meteor.call(ClientAPI.methods.execMethod, PlayoutAPI.methods.roActivateHold, this.props.runningOrder._id, (err, res) => {
				if (err) {
					// TODO
					// this.handleActivationError(err)
					console.log(err)
					return
				}
			})
		}
	}

	activate = () => {
		if (this.props.studioMode && (!this.props.runningOrder.active || (this.props.runningOrder.active && this.props.runningOrder.rehearsal))) {
			Meteor.call(ClientAPI.methods.execMethod, PlayoutAPI.methods.roActivate, this.props.runningOrder._id, false, (err, res) => {
				if (err || (res && res.error)) {
					this.handleActivationError(err || res)
					return
				}
				if (typeof this.props.onActivate === 'function') this.props.onActivate(false)
			})
		}
	}

	activateRehearsal = () => {
		if (this.props.studioMode && (!this.props.runningOrder.active || (this.props.runningOrder.active && !this.props.runningOrder.rehearsal))) {
			Meteor.call(ClientAPI.methods.execMethod, PlayoutAPI.methods.roActivate, this.props.runningOrder._id, true, (err, res) => {
				if (err || (res & res.error)) {
					this.handleActivationError(err || res)
					return
				}
				if (typeof this.props.onActivate === 'function') this.props.onActivate(true)
			})
		}
	}

	deactivate = () => {
		if (this.props.studioMode && this.props.runningOrder.active) {
			Meteor.call(ClientAPI.methods.execMethod, PlayoutAPI.methods.roDeactivate, this.props.runningOrder._id)
		}
	}

	reloadRunningOrder = (changeRehearsal?: boolean) => {
		const p = new Promise((resolve, reject) => {
			if (this.props.studioMode) {
				Meteor.call(ClientAPI.methods.execMethod, PlayoutAPI.methods.reloadData, this.props.runningOrder._id, changeRehearsal, (err, result) => {
					if (err) {
						console.error(err)
						reject(err)
						return
					}

					$('html,body').scrollTop(0)
					resolve()
				})
			} else {
				reject()
			}
		})

		return p
	}

	onReloadAndActivate = () => {
		if (this.props.studioMode) {
			this.reloadRunningOrder().then(() => {
				console.log('Running order reloaded')
			}).catch((reason) => {
				console.log('Not in Studio mode or Could not reload.', reason)
			})
		}
	}

	render () {
		const { t } = this.props
		return <React.Fragment>
			<div className={ClassNames('header running-order', {
				'active': this.props.runningOrder.active,
				'not-active': !this.props.runningOrder.active,

				'rehearsal': this.props.runningOrder.rehearsal
			})}>
				{this.props.studioInstallation && <RunningOrderSystemStatus studioInstallation={this.props.studioInstallation} runningOrder={this.props.runningOrder} />}
				<WarningDisplay studioMode={this.props.studioMode} inActiveROView={this.props.inActiveROView}
					runningOrder={this.props.runningOrder} onReloadAndActivate={this.onReloadAndActivate} />
				<div className='row first-row super-dark'>
					<div className='flex-col left horizontal-align-left'>
						{/* !!! TODO: This is just a temporary solution !!! */}
						<div className='badge mod'>
							<div className='media-elem mrs sofie-logo' />
							<div className='bd mls'><span className='logo-text'></span></div>
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
							this.props.studioMode ?
								this.props.runningOrder && this.props.runningOrder.active ?
									<React.Fragment>
										<MenuItem onClick={(e) => this.deactivate()}>
											{t('Deactivate')}
										</MenuItem>
										<MenuItem onClick={(e) => this.take()}>
											{t('Take')}
										</MenuItem>
										<MenuItem onClick={(e) => this.hold()}>
											{t('Hold')}
										</MenuItem>
										{this.props.runningOrder.rehearsal ?
											<React.Fragment>
												<hr/>
												<MenuItem onClick={(e) => this.activate()}>
													{t('Activate')}
												</MenuItem>
												<hr/>
											</React.Fragment> :
											<React.Fragment>
												<hr />
												<MenuItem onClick={(e) => this.activateRehearsal()}>
													{t('Activate (Rehearsal)')}
												</MenuItem>
												<hr />
											</React.Fragment>
										}
									</React.Fragment> :
									<React.Fragment>
										<MenuItem onClick={(e) => this.activate()}>
											{t('Activate')}
										</MenuItem>
										<MenuItem onClick={(e) => this.activateRehearsal()}>
											{t('Activate (Rehearsal)')}
										</MenuItem>
									</React.Fragment> :
								null
						}
						{
							this.props.studioMode &&
								<MenuItem onClick={(e) => this.reloadRunningOrder()}>
									{t('Reload running order')}
								</MenuItem>
						}
						{
							!this.props.studioMode &&
								<MenuItem>
									{t('No actions available')}
								</MenuItem>
						}
					</ContextMenu>
					<ContextMenuTrigger id='running-order-context-menu' attributes={{
						className: 'flex-col col-timing horizontal-align-center'
					}}>
						<TimingDisplay {...this.props} />
					</ContextMenuTrigger>
				</div>
				<div className='row dark'>
					<div className='col c12 running-order-overview'>
						{ this.props.runningOrder && <RunningOrderOverview runningOrderId={this.props.runningOrder._id} /> }
					</div>
				</div>
			</div>
			<ModalDialog title={t('Error')} acceptText={t('OK')} show={!!this.state.isError} onAccept={this.discardError} onDiscard={this.discardError}>
				<p>{this.state.errorMessage}</p>
			</ModalDialog>
		</React.Fragment>
	}
})

interface IProps {
	match?: {
		params: {
			runningOrderId: string
		}
	}
	runningOrderId?: string
	inActiveROView?: boolean
}

interface IState {
	timeScale: number
	studioMode: boolean
	contextMenuContext: any
	bottomMargin: string
	followLiveSegments: boolean
	manualSetAsNext: boolean
	subsReady: boolean
	usedHotkeys: Array<HotkeyDefinition>
}

export enum RunningOrderViewEvents {
	'rewindsegments'	=	'sofie:roRewindSegments'
}

interface ITrackedProps {
	runningOrderId: string
	runningOrder?: RunningOrder
	segments: Array<Segment>
	studioInstallation?: StudioInstallation
}
export const RunningOrderView = translateWithTracker<IProps, IState, ITrackedProps>((props: IProps, state) => {

	let runningOrderId
	if (props.match && props.match.params.runningOrderId) {
		runningOrderId = decodeURIComponent(props.match.params.runningOrderId)
	} else if (props.runningOrderId) {
		runningOrderId = props.runningOrderId
	}

	let runningOrder = RunningOrders.findOne({ _id: runningOrderId })
	let studioInstallation = runningOrder && StudioInstallations.findOne({ _id: runningOrder.studioInstallationId })
	// let roDurations = calculateDurations(runningOrder, segmentLines)
	return {
		runningOrderId: runningOrderId,
		runningOrder: runningOrder,
		segments: runningOrder ? Segments.find({ runningOrderId: runningOrder._id }, {
			sort: {
				'_rank': 1
			}
		}).fetch() : [],
		studioInstallation: studioInstallation,
	}
})(
class extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {

	private bindKeys: Array<{
		key: string,
		up?: (e: KeyboardEvent) => any,
		down?: (e: KeyboardEvent) => any,
		label: string,
		global?: boolean
	}> = []
	private _segments: _.Dictionary<React.ComponentClass<{}>> = {}

	constructor (props: Translated<IProps & ITrackedProps>) {
		super(props)

		const { t } = this.props

		this.bindKeys = [
			{
				key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_GO_TO_LIVE,
				up: this.onGoToLiveSegment,
				label: t('Go to On Air line'),
				global: true
			},
			{
				key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_REWIND_SEGMENTS,
				up: this.onRewindSegments,
				label: t('Rewind segments to start'),
				global: true
			}
		]

		this.state = {
			timeScale: 0.03,
			studioMode: getStudioMode(),
			contextMenuContext: null,
			bottomMargin: '',
			followLiveSegments: true,
			manualSetAsNext: false,
			subsReady: false,
			usedHotkeys: _.clone(this.bindKeys)
		}
	}

	componentWillMount () {
		// Subscribe to data:
		let runningOrderId = this.props.runningOrderId

		this.subscribe('runningOrders', {
			_id: runningOrderId
		})
		this.subscribe('segments', {
			runningOrderId: runningOrderId
		})
		this.subscribe('segmentLines', {
			runningOrderId: runningOrderId
		})
		this.subscribe('segmentLineItems', {
			runningOrderId: runningOrderId
		})
		this.subscribe('segmentLineAdLibItems', {
			runningOrderId: runningOrderId
		})
		this.autorun(() => {
			let runningOrder = RunningOrders.findOne(runningOrderId)
			if (runningOrder) {
				this.subscribe('studioInstallations', {
					_id: runningOrder.studioInstallationId
				})
				this.subscribe('showStyles', {
					_id: runningOrder.showStyleId
				})
			}
		})
		this.autorun(() => {
			let subsReady = this.subscriptionsReady()
			if (subsReady !== this.state.subsReady) {
				this.setState({
					subsReady: subsReady
				})
			}
		})
	}

	componentDidMount () {
		$(document.body).addClass(['dark', 'vertical-overflow-only'])
		$(window).on('scroll', this.onWindowScroll)
		let preventDefault = (e) => {
			e.preventDefault()
			e.stopImmediatePropagation()
			e.stopPropagation()
		}
		_.each(this.bindKeys, (k) => {
			const method = k.global ? mousetrap.bindGlobal : mousetrap.bind
			if (k.up) {
				method(k.key, (e: KeyboardEvent) => {
					if (k.up) k.up(e)
				}, 'keyup')
				method(k.key, (e: KeyboardEvent) => {
					preventDefault(e)
				}, 'keydown')
			}
			if (k.down) {
				method(k.key, (e: KeyboardEvent) => {
					if (k.down) k.down(e)
				}, 'keydown')
			}
		})
	}

	componentDidUpdate (prevProps: IProps & ITrackedProps, prevState: IState) {
		if (this.props.runningOrder &&
			prevProps.runningOrder && prevProps.runningOrder.currentSegmentLineId !== this.props.runningOrder.currentSegmentLineId &&
			this.state.manualSetAsNext) {

			this.setState({
				manualSetAsNext: false,
				followLiveSegments: true
			})
		} else if (this.props.runningOrder &&
			prevProps.runningOrder && prevProps.runningOrder.active && !this.props.runningOrder.active) {
			this.setState({
				followLiveSegments: true
			})
		}
	}

	componentWillUnmount () {
		this._cleanUp()
		$(document.body).removeClass(['dark', 'vertical-overflow-only'])
		$(window).off('scroll', this.onWindowScroll)

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

	onRewindSegments = () => {
		const event = new Event(RunningOrderViewEvents.rewindsegments)
		window.dispatchEvent(event)
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

	onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
		if (!e.altKey && e.ctrlKey && !e.shiftKey && !e.metaKey &&
			// @ts-ignore
			!window.keyboardModifiers.altRight &&
			e.deltaY !== 0) {
			this.onTimeScaleChange(Math.min(500, this.state.timeScale * (1 + 0.001 * (e.deltaY * -1))))
			e.preventDefault()
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

	onContextMenu = (contextMenuContext: any) => {
		this.setState({
			contextMenuContext
		})
	}

	onSetNext = (segmentLine: SegmentLine) => {
		if (this.state.studioMode && segmentLine && segmentLine._id && this.props.runningOrder) {
			Meteor.call(ClientAPI.methods.execMethod, PlayoutAPI.methods.roSetNext, this.props.runningOrder._id, segmentLine._id)
			this.setState({
				manualSetAsNext: true
			})
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
												segmentId={segment._id}
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
				<div className='segment-timeline-container'>
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

	onRegisterHotkeys = (hotkeys: Array<HotkeyDefinition>) => {
		// @ts-ignore
		this.state.usedHotkeys = this.state.usedHotkeys.concat(hotkeys) // we concat directly to the state object member, because we need to
		this.setState({
			usedHotkeys: this.state.usedHotkeys
		})
	}

	onContextMenuTop = (e: React.MouseEvent<HTMLDivElement>): boolean => {
		if (!getDeveloperMode()) {
			e.preventDefault()
			e.stopPropagation()
		}
		return false
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
					runningOrder={this.props.runningOrder}
					defaultDuration={DEFAULT_DISPLAY_DURATION}>
					<div className='running-order-view' style={this.getStyle()} onWheelCapture={this.onWheel} onContextMenu={this.onContextMenuTop}>
						<ErrorBoundary>
							<KeyboardFocusMarker />
						</ErrorBoundary>
						<ErrorBoundary>
							<RunningOrderHeader
								runningOrder={this.props.runningOrder}
								studioInstallation={this.props.studioInstallation}
								onActivate={this.onActivate}
								studioMode={this.state.studioMode}
								onRegisterHotkeys={this.onRegisterHotkeys}
								inActiveROView={this.props.inActiveROView} />
						</ErrorBoundary>
						<ErrorBoundary>
							<SegmentContextMenu
								contextMenuContext={this.state.contextMenuContext}
								runningOrder={this.props.runningOrder}
								onSetNext={this.onSetNext}
								studioMode={this.state.studioMode} />
						</ErrorBoundary>
						{this.renderSegmentsList()}
						{!this.state.followLiveSegments &&
							<div className='running-order-view__go-to-onAir' onClick={this.onGoToLiveSegment}>{t('ON AIR')}</div>
						}
						<ErrorBoundary>
							<InspectorDrawer
								segments={this.props.segments}
								hotkeys={this.state.usedHotkeys}
								runningOrder={this.props.runningOrder}
								studioInstallation={this.props.studioInstallation}
								studioMode={this.state.studioMode}
								onChangeBottomMargin={this.onChangeBottomMargin}
								onRegisterHotkeys={this.onRegisterHotkeys} />
						</ErrorBoundary>
					</div>
				</RunningOrderTimingProvider>
			)
		} else if (this.state.subsReady) {
			return (
				<div className='running-order-view running-order-view--unpublished'>
					<div className='running-order-view__label'>
						<p>
							{t('This running order has been unpublished from Sofie.')}
						</p>
						<p>
							<Route render={({history}) => (
								<button className='btn btn-primary' onClick={() => { history.push('/runningOrders') }}>
									{t('Return to list')}
								</button>
							)} />
						</p>
					</div>
				</div>
			)
		} else {
			return (
				<div className='running-order-view running-order-view--loading'>
					<Spinner />
				</div>
			)
		}
	}
}
)
