import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as VelocityReact from 'velocity-react'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { translate } from 'react-i18next'
import timer from 'react-timer-hoc'
import * as CoreIcon from '@nrk/core-icons/jsx'
import { Spinner } from '../lib/Spinner'
import * as ClassNames from 'classnames'
import * as $ from 'jquery'
import * as _ from 'underscore'
import Moment from 'react-moment'
import { NavLink, Route, Prompt } from 'react-router-dom'
import { PlayoutAPI } from '../../lib/api/playout'
import { RunningOrder, RunningOrders, RunningOrderHoldState } from '../../lib/collections/RunningOrders'
import { Segment, Segments } from '../../lib/collections/Segments'
import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'
import { SegmentLine, SegmentLines } from '../../lib/collections/SegmentLines'

import { ContextMenu, MenuItem, ContextMenuTrigger } from 'react-contextmenu'

import { RunningOrderTimingProvider, withTiming, WithTiming } from './RunningOrderView/RunningOrderTiming'
import { SegmentTimelineContainer, SegmentLineItemUi } from './SegmentTimeline/SegmentTimelineContainer'
import { SegmentContextMenu } from './SegmentTimeline/SegmentContextMenu'
import { InspectorDrawer } from './InspectorDrawer/InspectorDrawer'
import { RunningOrderOverview } from './RunningOrderView/RunningOrderOverview'
import { RunningOrderSystemStatus } from './RunningOrderView/RunningOrderSystemStatus'

import { getCurrentTime } from '../../lib/lib'
import { RundownUtils } from '../lib/rundown'

import * as mousetrap from 'mousetrap'
import { ErrorBoundary } from '../lib/ErrorBoundary'
import { ModalDialog, doModalDialog } from '../lib/ModalDialog'
import { DEFAULT_DISPLAY_DURATION } from '../../lib/RunningOrder'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { getStudioMode, getDeveloperMode } from '../lib/localStorage'
import { scrollToSegmentLine, scrollToPosition, scrollToSegment } from '../lib/viewPort'
import { AfterBroadcastForm } from './AfterBroadcastForm'
import { Tracker } from 'meteor/tracker'
import { RunningOrderFullscreenControls } from './RunningOrderView/RunningOrderFullscreenControls'
import { mousetrapHelper } from '../lib/mousetrapHelper'
import { SnapshotFunctionsAPI } from '../../lib/api/shapshot'
import { ShowStyleBases, ShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { callMethod } from '../lib/clientAPI'
import { RunningOrderViewNotifier, RONotificationEvent } from './RunningOrderView/RunningOrderNotifier'
import { NotificationCenterPanelToggle, NotificationCenterPanel } from '../lib/notifications/NotificationCenterPanel'
import { NotificationCenter } from '../lib/notifications/notifications'

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
	oneMinuteBeforeAction: (e) => void
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

		oneMinuteBeforeAction = (e: any) => {
			this.setState({
				plannedStartCloseShow: false
			})

			this.props.oneMinuteBeforeAction(e)
		}

		render () {
			const { t } = this.props

			if (!this.props.runningOrder) return null

			return <ModalDialog
				title={t('Start time is close')}
				acceptText={t('Yes')}
				secondaryText={t('No')}
				onAccept={this.oneMinuteBeforeAction}
				onDiscard={this.discard}
				onSecondary={this.discard}
				show={
					this.props.studioMode &&
					this.state.plannedStartCloseShow &&
					!(
						this.props.runningOrder.active &&
						!this.props.runningOrder.rehearsal
					) &&
					this.props.runningOrder.active
				}
			>
				<p>{t('You are in rehearsal mode, the broadcast starts in less than 1 minute. Do you want to reset the rundown and go into playout mode?')}</p>
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
	RUNNING_ORDER_RESET_RUNNING_ORDER = 'mod+shift+f12',
	RUNNING_ORDER_TOGGLE_DRAWER = 'tab',
	ADLIB_QUEUE_MODIFIER = 'shift',
	RUNNING_ORDER_NEXT_FORWARD = 'f9',
	RUNNING_ORDER_NEXT_DOWN = 'f10',
	RUNNING_ORDER_NEXT_BACK = 'shift+f9',
	RUNNING_ORDER_NEXT_UP = 'shift+f10',
	RUNNING_ORDER_DISABLE_NEXT_ELEMENT = 'g',
	RUNNING_ORDER_UNDO_DISABLE_NEXT_ELEMENT = 'shift+g',
}

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
				<span className='timing-clock time-now'>
					<Moment interval={0} format='HH:mm:ss' date={getCurrentTime()} />
					{this.props.runningOrder.holdState && this.props.runningOrder.holdState !== RunningOrderHoldState.COMPLETE ?
						<div className='running-order__header-status running-order__header-status--hold'>{t('Hold')}</div>
						: null
					}
				</span>
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
					key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_RESET_RUNNING_ORDER,
					up: this.keyResetRunningOrder,
					label: t('Reload Running Order'),
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
			const method = k.global ? mousetrapHelper.bindGlobal : mousetrapHelper.bind
			if (k.up) {
				method(k.key, (e: KeyboardEvent) => {
					if (disableInInputFields(e)) return
					preventDefault(e)
					if (k.up) k.up(e)
				}, 'keyup', 'RunningOrderHeader')
				method(k.key, (e: KeyboardEvent) => {
					if (disableInInputFields(e)) return
					preventDefault(e)
				}, 'keydown', 'RunningOrderHeader')
			}
			if (k.down) {
				method(k.key, (e: KeyboardEvent) => {
					if (disableInInputFields(e)) return
					preventDefault(e)
					if (k.down) k.down(e)
				}, 'keydown', 'RunningOrderHeader')
			}
		})

		if (typeof this.props.onRegisterHotkeys === 'function') {
			this.props.onRegisterHotkeys(this.bindKeys)
		}
	}

	componentWillUnmount () {
		_.each(this.bindKeys, (k) => {
			if (k.up) {
				mousetrapHelper.unbind(k.key, 'RunningOrderHeader', 'keyup')
				mousetrapHelper.unbind(k.key, 'RunningOrderHeader', 'keydown')
			}
			if (k.down) {
				mousetrapHelper.unbind(k.key, 'RunningOrderHeader', 'keydown')
			}
		})
	}
	keyTake = (e: ExtendedKeyboardEvent) => {
		if (e.key !== 'Enter' || e.location === 3) { // only allow the rightmost enter key
			this.take(e)
		}
	}
	keyHold = (e: ExtendedKeyboardEvent) => {
		this.hold(e)
	}
	keyActivate = (e: ExtendedKeyboardEvent) => {
		this.activate(e)
	}
	keyActivateRehearsal = (e: ExtendedKeyboardEvent) => {
		this.activateRehearsal(e)
	}

	keyDeactivate = (e: ExtendedKeyboardEvent) => {
		this.deactivate(e)
	}
	keyResetRunningOrder = (e: ExtendedKeyboardEvent) => {
		this.resetRunningOrder(e)
	}
	keyReloadRunningOrder = (e: ExtendedKeyboardEvent) => {
		this.reloadRunningOrder(e)
	}
	keyMoveNextForward = (e: ExtendedKeyboardEvent) => {
		// "forward" = to next SegmentLine
		this.moveNext(e, 1, 0)
	}
	keyMoveNextBack = (e: ExtendedKeyboardEvent) => {
		// "down" = to next Segment
		this.moveNext(e, -1, 0)
	}
	keyMoveNextDown = (e: ExtendedKeyboardEvent) => {
		// "down" = to next Segment
		this.moveNext(e, 0, 1)
	}
	keyMoveNextUp = (e: ExtendedKeyboardEvent) => {
		// "down" = to next Segment
		this.moveNext(e, 0, -1)
	}
	keyDisableNextSegmentLineItem = (e: any) => {
		if (this.props.studioMode) {
			callMethod(e, PlayoutAPI.methods.roDisableNextSegmentLineItem, this.props.runningOrder._id, false, (err, segmentLineItemId) => {
				if (err) {
					// todo: notify the user
					console.error(err)
				} else {
					// console.log('segmentLineItemId', segmentLineItemId)
				}
			})
		}
	}
	keyDisableNextSegmentLineItemUndo = (e: any) => {
		if (this.props.studioMode) {
			callMethod(e, PlayoutAPI.methods.roDisableNextSegmentLineItem, this.props.runningOrder._id, true, (err, segmentLineItemId) => {
				if (err) {
					// todo: notify the user
					console.error(err)
				} else {
					// console.log('segmentLineItemId', segmentLineItemId)
				}
			})
		}
	}

	take = (e: any) => {
		if (this.props.studioMode) {
			if (this.props.runningOrder.active) {
				callMethod(e, PlayoutAPI.methods.userRoTake, this.props.runningOrder._id)
			}
		}
		// console.log(new Date(getCurrentTime()))
	}
	moveNext = (e: any, horizonalDelta: number, verticalDelta: number) => {
		if (this.props.studioMode) {
			if (this.props.runningOrder.active) {
				callMethod(e, PlayoutAPI.methods.roMoveNext, this.props.runningOrder._id, horizonalDelta, verticalDelta, (err, segmentLineId) => {
					if (err) {
						// todo: notify the user
						console.error(err)
					} else {
						scrollToSegmentLine(segmentLineId)
					}
				})
			}
		}
		// console.log(new Date(getCurrentTime()))
	}

	handleActivationError = (err) => {
		const { t } = this.props
		if (err.error === 409) {
			this.setState({
				isError: true,
				errorMessage: t('Only a single Running Order can be active in a studio at the same time. Please deactivate the other Running Order and try again.')
			})
		}
	}

	discardError = () => {
		this.setState({
			isError: false
		})
	}

	hold = (e: any) => {
		if (this.props.studioMode && this.props.runningOrder.active) {
			callMethod(e, PlayoutAPI.methods.roActivateHold, this.props.runningOrder._id, (err, res) => {
				if (err) {
					// TODO
					// this.handleActivationError(err)
					console.error(err)
					return
				}
			})
		}
	}
	runningOrderShouldHaveStarted () {
		return getCurrentTime() > (this.props.runningOrder.expectedStart || 0)
	}
	runningOrderShouldHaveEnded () {
		return getCurrentTime() > (this.props.runningOrder.expectedStart || 0) + (this.props.runningOrder.expectedDuration || 0)
	}

	activate = (e: any) => {
		const { t } = this.props
		if (e.persist) e.persist()

		if (
			this.props.studioMode &&
			(
				!this.props.runningOrder.active ||
				(
					this.props.runningOrder.active &&
					this.props.runningOrder.rehearsal
				)
			)
		) {
			let doActivate = (le: any) => {
				callMethod(e, PlayoutAPI.methods.roActivate, this.props.runningOrder._id, false, (err, res) => {
					if (err || (res && res.error)) {
						this.handleActivationError(err || res)
						return
					}
					if (typeof this.props.onActivate === 'function') this.props.onActivate(false)
				})
			}
			if (!this.runningOrderShouldHaveStarted() ) {
				// The broadcast hasn't started yet
				doModalDialog({
					title: this.props.runningOrder.name,
					message: t('Do you want to activate this Running Order?'),
					onAccept: (le: any) => {
						this.rewindSegments()
						callMethod(e, PlayoutAPI.methods.roResetAndActivate, this.props.runningOrder._id, (err, res) => {
							if (err || (res && res.error)) {
								this.handleActivationError(err || res)
								return
							}
							this.deferFlushAndRewindSegments()

							if (typeof this.props.onActivate === 'function') this.props.onActivate(false)
						})
					}
				})
			} else if (!this.runningOrderShouldHaveEnded() ) {
				// The broadcast has started
				doActivate(e)
			} else {
				// The broadcast has ended, going into active mode is probably not what you want to do
				doModalDialog({
					title: this.props.runningOrder.name,
					message: t('The planned end time has passed, are you sure you want to activate this Running Order?'),
					onAccept: (le: any) => {
						doActivate(e)
					}
				})
			}
		}
	}
	activateRehearsal = (e: any) => {
		const { t } = this.props
		if (e.persist) e.persist()

		if (
			this.props.studioMode &&
			(
				!this.props.runningOrder.active ||
				(
					this.props.runningOrder.active &&
					!this.props.runningOrder.rehearsal
				)
			)
		) {
			let doActivateRehersal = () => {
				callMethod(e, PlayoutAPI.methods.roActivate, this.props.runningOrder._id, true, (err, res) => {
					if (err || (res && res.error)) {
						this.handleActivationError(err || res)
						return
					}
					if (typeof this.props.onActivate === 'function') this.props.onActivate(true)
				})
			}
			if (!this.runningOrderShouldHaveStarted()) {
				// The broadcast hasn't started yet
				if (!this.props.runningOrder.active) {
					// inactive, do the full preparation:
					callMethod(e, PlayoutAPI.methods.roPrepareForBroadcast, this.props.runningOrder._id, (err, res) => {
						if (err || (res && res.error)) {
							this.handleActivationError(err || res)
							return
						}
						if (typeof this.props.onActivate === 'function') this.props.onActivate(true)
					})
				} else if (!this.props.runningOrder.rehearsal) {
					// Active, and not in rehearsal
					doModalDialog({
						title: this.props.runningOrder.name,
						message: t('Are you sure you want to activate Rehearsal Mode?'),
						onAccept: () => {
							doActivateRehersal()
						}
					})
				} else {
					// Already in rehersal, do nothing
				}
			} else {
				// The broadcast has started
				if (!this.runningOrderShouldHaveEnded()) {
					// We are in the broadcast
					doModalDialog({
						title: this.props.runningOrder.name,
						message: t('Are you sure you want to activate Rehearsal Mode?'),
						onAccept: () => {
							doActivateRehersal()
						}
					})
				} else {
					// The broadcast has ended
					doActivateRehersal()
				}
			}
		}
	}
	deactivate = (e: any) => {
		const { t } = this.props
		if (e.persist) e.persist()

		if (this.props.studioMode && this.props.runningOrder.active) {
			if (this.runningOrderShouldHaveStarted()) {
				if (this.props.runningOrder.rehearsal) {
					// We're in rehearsal mode
					callMethod(e, PlayoutAPI.methods.roDeactivate, this.props.runningOrder._id)
				} else {
					doModalDialog({
						title: this.props.runningOrder.name,
						message: t('Are you sure you want to deactivate this Running Order?\n(This will clear the outputs)'),
						onAccept: () => {
							callMethod(e, PlayoutAPI.methods.roDeactivate, this.props.runningOrder._id)
						}
					})
				}
			} else {
				// Do it right away
				callMethod(e, PlayoutAPI.methods.roDeactivate, this.props.runningOrder._id)
			}
		}
	}

	resetRunningOrder = (e: any) => {
		const { t } = this.props
		if (e.persist) e.persist()

		let doReset = () => {
			this.rewindSegments() // Do a rewind right away
			callMethod(e, PlayoutAPI.methods.roResetRunningOrder, this.props.runningOrder._id, (err) => {
				if (err) {
					// TODO: notify user
					console.error(err)
					this.deferFlushAndRewindSegments()
					return
				}
				this.deferFlushAndRewindSegments()
			})
		}
		if ((this.props.runningOrder.active && !this.props.runningOrder.rehearsal)) {
			// The running order is active and not in rehersal
			doModalDialog({
				title: this.props.runningOrder.name,
				message: t('Are you sure you want to reset this Running Order?'),
				onAccept: () => {
					doReset()
				}
			})
		} else {
			doReset()
		}
	}

	reloadRunningOrder = (e: any, changeRehearsal?: boolean) => {
		const p = new Promise((resolve, reject) => {
			if (this.props.studioMode) {
				callMethod(e, PlayoutAPI.methods.reloadData, this.props.runningOrder._id, changeRehearsal, (err, result) => {
					if (err) {
						console.error(err)
						reject(err)
						return
					}

					if (this.props.runningOrder && this.props.runningOrder.nextSegmentLineId) scrollToSegmentLine(this.props.runningOrder.nextSegmentLineId)
					resolve()
				})
			} else {
				reject()
			}
		})

		return p
	}

	takeRunningOrderSnapshot = (e) => {
		const p = new Promise((resolve, reject) => {
			if (this.props.studioMode) {
				callMethod(e, SnapshotFunctionsAPI.STORE_RUNNING_ORDER_SNAPSHOT, this.props.runningOrder._id, 'Taken by user', (err, result) => {
					if (err) {
						console.error(err)
						reject(err)
						return
					} else {
						// todo: notify user of success, just a little nudge
						resolve()
					}
				})
			} else {
				reject()
			}
		})

		return p

	}

	resetAndActivateRunningOrder = (e: any) => {
		// Called from the ModalDialog, 1 minute before broadcast starts
		if (this.props.studioMode) {
			this.rewindSegments() // Do a rewind right away
			callMethod(e, PlayoutAPI.methods.roResetAndActivate, this.props.runningOrder._id, (err, res) => {
				if (err || (res && res.error)) {
					this.handleActivationError(err || res)
					return
				}
				this.deferFlushAndRewindSegments()
				if (typeof this.props.onActivate === 'function') this.props.onActivate(false)
			})
		}
	}

	rewindSegments () {
		window.dispatchEvent(new Event(RunningOrderViewEvents.rewindsegments))
	}
	deferFlushAndRewindSegments () {
		// Do a rewind later, when the UI has updated
		Meteor.defer(() => {
			Tracker.flush()
			Meteor.setTimeout(() => {
				window.dispatchEvent(new Event(RunningOrderViewEvents.rewindsegments))
				window.dispatchEvent(new Event(RunningOrderViewEvents.goToTop))
			}, 500)
		})
	}

	render () {
		const { t } = this.props
		return <React.Fragment>
			<div className={ClassNames('header running-order', {
				'active': this.props.runningOrder.active,
				'not-active': !this.props.runningOrder.active,

				'rehearsal': this.props.runningOrder.rehearsal
			})}>
				<ContextMenu id='running-order-context-menu'>
					<div className='react-contextmenu-label'>
						{this.props.runningOrder && this.props.runningOrder.name}
					</div>
					{
						this.props.studioMode ?
							<React.Fragment>
								{
									!(this.props.runningOrder.active && this.props.runningOrder.rehearsal) ?
										(
											!this.runningOrderShouldHaveStarted() && !this.props.runningOrder.active ?
												<MenuItem onClick={(e) => this.activateRehearsal(e)}>
													{t('Prepare Studio and Activate (Rehearsal)')}
												</MenuItem> :
												<MenuItem onClick={(e) => this.activateRehearsal(e)}>
													{t('Activate (Rehearsal)')}
												</MenuItem>
										) : (
											<MenuItem onClick={(e) => this.activate(e)}>
												{t('Activate')}
											</MenuItem>
										)
								}
								{
									this.props.runningOrder.active ?
										<MenuItem onClick={(e) => this.deactivate(e)}>
											{t('Deactivate')}
										</MenuItem> :
										null
								}
								{
									this.props.runningOrder.active ?
										<MenuItem onClick={(e) => this.take(e)}>
											{t('Take')}
										</MenuItem> :
										null
								}
								{
									this.props.runningOrder.active ?
										<MenuItem onClick={(e) => this.hold(e)}>
											{t('Hold')}
										</MenuItem> :
										null
								}
								{
									!(this.props.runningOrder.active && !this.props.runningOrder.rehearsal) ?
										<MenuItem onClick={(e) => this.resetRunningOrder(e)}>
											{t('Reset Running Order')}
										</MenuItem> :
										null
								}
								<MenuItem onClick={(e) => this.reloadRunningOrder(e)}>
									{t('Reload ENPS Data')}
								</MenuItem>
								<MenuItem onClick={(e) => this.takeRunningOrderSnapshot(e)}>
									{t('Store Snapshot')}
								</MenuItem>
							</React.Fragment> :
							<React.Fragment>
								<MenuItem>
									{t('No actions available')}
								</MenuItem>
							</React.Fragment>
					}
				</ContextMenu>
				<ContextMenuTrigger id='running-order-context-menu' attributes={{
					className: 'flex-col col-timing horizontal-align-center'
				}}>
					<WarningDisplay
						studioMode={this.props.studioMode}
						inActiveROView={this.props.inActiveROView}
						runningOrder={this.props.runningOrder}
						oneMinuteBeforeAction={this.resetAndActivateRunningOrder}
					/>
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
						<TimingDisplay {...this.props} />
						{this.props.studioInstallation && <RunningOrderSystemStatus studioInstallation={this.props.studioInstallation} runningOrder={this.props.runningOrder} />}
					</div>
					<div className='row dark'>
						<div className='col c12 running-order-overview'>
							{ this.props.runningOrder && <RunningOrderOverview runningOrderId={this.props.runningOrder._id} /> }
						</div>
					</div>
				</ContextMenuTrigger>
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
	showNotifications: boolean
}

export enum RunningOrderViewEvents {
	'rewindsegments'	=	'sofie:roRewindSegments',
	'goToLiveSegment'	=	'sofie:goToLiveSegment',
	'goToTop'			=	'sofie:goToTop'
}

interface ITrackedProps {
	runningOrderId: string
	runningOrder?: RunningOrder
	segments: Array<Segment>
	studioInstallation?: StudioInstallation
	showStyleBase?: ShowStyleBase
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
		showStyleBase: runningOrder && ShowStyleBases.findOne(runningOrder.showStyleBaseId)
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
	private usedArgumentKeys: Array<{
		key: string,
		up?: (e: KeyboardEvent) => any,
		down?: (e: KeyboardEvent) => any,
		label: string,
		global?: boolean
	}> = []
	private _segments: _.Dictionary<React.ComponentClass<{}>> = {}
	private _notifier: RunningOrderViewNotifier

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

		this.usedArgumentKeys = []

		this.state = {
			timeScale: 0.03,
			studioMode: getStudioMode(),
			contextMenuContext: null,
			bottomMargin: '',
			followLiveSegments: true,
			manualSetAsNext: false,
			subsReady: false,
			usedHotkeys: _.clone(this.bindKeys).concat([
				// Register additional hotkeys or legend entries
				{
					key: 'Esc',
					label: t('Cancel currently pressed hotkey')
				},
				{
					key: 'F11',
					label: t('Change to fullscreen mode')
				}
			]),
			showNotifications: false
		}

		this._notifier = new RunningOrderViewNotifier(this.props.runningOrderId)
		this._notifier.onRONotificationClick = this.onRONotificationClick
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
				this.subscribe('showStyleBases', {
					_id: runningOrder.showStyleBaseId
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
					if (disableInInputFields(e)) return
					if (k.up) k.up(e)
				}, 'keyup')
				method(k.key, (e: KeyboardEvent) => {
					if (disableInInputFields(e)) return
					preventDefault(e)
				}, 'keydown')
			}
			if (k.down) {
				method(k.key, (e: KeyboardEvent) => {
					if (disableInInputFields(e)) return
					if (k.down) k.down(e)
				}, 'keydown')
			}
		})

		window.addEventListener(RunningOrderViewEvents.goToLiveSegment, this.onGoToLiveSegment)
		window.addEventListener(RunningOrderViewEvents.goToTop, this.onGoToTop)
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
		} else if (this.props.runningOrder &&
			prevProps.runningOrder && !prevProps.runningOrder.active && this.props.runningOrder.active &&
			this.props.runningOrder.nextSegmentLineId) {
			scrollToSegmentLine(this.props.runningOrder.nextSegmentLineId)
		}

		if (typeof this.props.runningOrder !== typeof this.props.runningOrder ||
			(this.props.runningOrder || {_id: ''})._id !== (prevProps.runningOrder || {_id: ''})._id ||
			(this.props.runningOrder || {active: false}).active !== (prevProps.runningOrder || {active: false}).active ||
			this.state.studioMode !== prevState.studioMode) {
			if (this.props.runningOrder && this.props.runningOrder.active && this.state.studioMode && !getDeveloperMode()) {
				$(window).on('beforeunload', this.onBeforeUnload)
			} else {
				$(window).off('beforeunload', this.onBeforeUnload)
			}
		}

		if (typeof this.props.showStyleBase !== typeof prevProps.showStyleBase ||
			this.props.showStyleBase && this.props.showStyleBase.runtimeArguments) {
			this.refreshHotkeys()
		}
	}

	refreshHotkeys = () => {
		let preventDefault = (e) => {
			e.preventDefault()
			e.stopImmediatePropagation()
			e.stopPropagation()
		}
		const noOp = (e) => {
			if (disableInInputFields(e)) return
			preventDefault(e)
		}

		this.usedArgumentKeys.forEach((k) => {
			if (k.up) {
				mousetrapHelper.unbind(k.key, 'RuntimeArguments', 'keyup')
				mousetrapHelper.unbind(k.key, 'RuntimeArguments', 'keydown')
			}
			if (k.down) {
				mousetrapHelper.unbind(k.key, 'RuntimeArguments', 'keydown')
			}
		})
		this.usedArgumentKeys.length = 0

		if (this.props.showStyleBase) {
			_.each(this.props.showStyleBase.runtimeArguments, (i) => {
				const combos = i.hotkeys.split(',')
				_.each(combos, (combo) => {
					const handler = (e: KeyboardEvent) => {
						if (disableInInputFields(e)) return

						if (this.props.runningOrder && this.props.runningOrder.active && this.props.runningOrder.nextSegmentLineId) {
							callMethod(e, PlayoutAPI.methods.roToggleSegmentLineArgument,
								this.props.runningOrder._id, this.props.runningOrder.nextSegmentLineId, i.property, i.value,
							(err) => {
								if (err) {
									// TODO: notify user
									console.error(err)
									return
								}
								console.log(`${combo} : ${i.property} ${i.value}`)
							})
						}
					}
					this.usedArgumentKeys.push({
						up: handler,
						key: combo,
						label: i.label || ''
					})
					mousetrapHelper.bind(combo, handler, 'keyup', 'RuntimeArguments')
					mousetrapHelper.bind(combo, noOp, 'keydown', 'RuntimeArguments')
				})
			})
		}
	}

	componentWillUnmount () {
		this._cleanUp()
		$(document.body).removeClass(['dark', 'vertical-overflow-only'])
		$(window).off('scroll', this.onWindowScroll)
		$(window).off('beforeunload', this.onBeforeUnload)

		_.each(this.bindKeys, (k) => {
			if (k.up) {
				mousetrap.unbind(k.key, 'keyup')
				mousetrap.unbind(k.key, 'keydown')
			}
			if (k.down) {
				mousetrap.unbind(k.key, 'keydown')
			}
		})

		_.each(this.usedArgumentKeys, (k) => {
			if (k.up) {
				mousetrapHelper.unbind(k.key, 'RuntimeArguments', 'keyup')
				mousetrapHelper.unbind(k.key, 'RuntimeArguments', 'keydown')
			}
			if (k.down) {
				mousetrapHelper.unbind(k.key, 'RuntimeArguments', 'keydown')
			}
		})

		window.removeEventListener(RunningOrderViewEvents.goToLiveSegment, this.onGoToLiveSegment)
		window.removeEventListener(RunningOrderViewEvents.goToTop, this.onGoToTop)

		this._notifier.stop()
	}

	onBeforeUnload = (e: any) => {
		const {t} = this.props

		e.preventDefault()
		e.returnValue = t('This running order is now active. Are you sure you want to exit this screen?')

		return t('This running order is now active. Are you sure you want to exit this screen?')
	}

	onRewindSegments = () => {
		window.dispatchEvent(new Event(RunningOrderViewEvents.rewindsegments))
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

	onGoToTop = () => {
		scrollToPosition(0)

		Meteor.setTimeout(() => {
			this.setState({
				followLiveSegments: true
			})
		}, 400)
	}
	onGoToLiveSegment = () => {
		if (this.props.runningOrder && this.props.runningOrder.active && !this.props.runningOrder.currentSegmentLineId &&
			this.props.runningOrder.nextSegmentLineId) {
			this.setState({
				followLiveSegments: true
			})
			scrollToSegmentLine(this.props.runningOrder.nextSegmentLineId)
			// allow for the scroll to finish
			Meteor.setTimeout(() => {
				this.setState({
					followLiveSegments: true
				})
			}, 400)
		} else {
			this.setState({
				followLiveSegments: true
			})
		}
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

	onSetNext = (segmentLine: SegmentLine, e: any, offset?: number) => {
		if (this.state.studioMode && segmentLine && segmentLine._id && this.props.runningOrder) {
			callMethod(e, PlayoutAPI.methods.roSetNext, this.props.runningOrder._id, segmentLine._id, offset)
			this.setState({
				manualSetAsNext: true
			})
		}
	}

	onSLItemDoubleClick = (item: SegmentLineItemUi, e: React.MouseEvent<HTMLDivElement>) => {
		if (this.state.studioMode && item && item._id && this.props.runningOrder && this.props.runningOrder.active && this.props.runningOrder.currentSegmentLineId) {
			callMethod(e, PlayoutAPI.methods.segmentLineItemTakeNow, this.props.runningOrder._id, this.props.runningOrder.currentSegmentLineId, item._id)
			console.log(item, e)
		}
	}

	onRONotificationClick = (e: RONotificationEvent) => {
		if (e.sourceLocator) {
			let segmentId = e.sourceLocator.segmentId

			if (!segmentId) {
				if (e.sourceLocator.segmentLineId) {
					let segmentLine = SegmentLines.findOne(e.sourceLocator.segmentLineId)
					if (segmentLine) {
						segmentId = segmentLine.segmentId
					}
				}
			}
			if (segmentId) {
				scrollToSegment(segmentId)
			}
		}
	}

	renderSegments () {
		if (this.props.segments) {
			return this.props.segments.map((segment, index, array) => {
				if (
					this.props.studioInstallation &&
					this.props.runningOrder &&
					this.props.showStyleBase
				) {
					return <ErrorBoundary key={segment._id}>
							<SegmentTimelineContainer
								studioInstallation={this.props.studioInstallation}
								showStyleBase={this.props.showStyleBase}
								followLiveSegments={this.state.followLiveSegments}
								segmentId={segment._id}
								runningOrder={this.props.runningOrder}
								liveLineHistorySize={100}
								timeScale={this.state.timeScale}
								onTimeScaleChange={this.onTimeScaleChange}
								onContextMenu={this.onContextMenu}
								onSegmentScroll={this.onSegmentScroll}
								isLastSegment={index === array.length - 1}
								onItemDoubleClick={this.onSLItemDoubleClick}
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

	onToggleNotifications = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!this.state.showNotifications === true) {
			NotificationCenter.snoozeAll()
		}

		this.setState({
			showNotifications: !this.state.showNotifications
		})
	}

	getStyle () {
		return {
			'marginBottom': this.state.bottomMargin
		}
	}

	render () {
		const { t } = this.props
		if (
			this.props.runningOrder &&
			this.props.studioInstallation &&
			this.props.showStyleBase
		) {
			return (
				<RunningOrderTimingProvider
					runningOrder={this.props.runningOrder}
					defaultDuration={DEFAULT_DISPLAY_DURATION}>
					<div className={ClassNames('running-order-view', {
						'notification-center-open': this.state.showNotifications
					})} style={this.getStyle()} onWheelCapture={this.onWheel} onContextMenu={this.onContextMenuTop}>
						<ErrorBoundary>
							{ this.state.studioMode && <KeyboardFocusMarker /> }
						</ErrorBoundary>
						<ErrorBoundary>
							<RunningOrderFullscreenControls isFollowingOnAir={this.state.followLiveSegments} onFollowOnAir={this.onGoToLiveSegment} onRewindSegments={this.onRewindSegments} />
						</ErrorBoundary>
						<ErrorBoundary>
							<VelocityReact.VelocityTransitionGroup enter={{
								animation: {
									translateX: ['0%', '100%']
								}, easing: 'ease-out', duration: 300
							}} leave={{
								animation: {
									translateX: ['100%', '0%']
								}, easing: 'ease-in', duration: 500
							}}>
								{this.state.showNotifications && <NotificationCenterPanel />}
							</VelocityReact.VelocityTransitionGroup>
						</ErrorBoundary>
						<ErrorBoundary>
							<NotificationCenterPanelToggle onClick={this.onToggleNotifications} isOpen={this.state.showNotifications} />
						</ErrorBoundary>
						<ErrorBoundary>
							{ this.state.studioMode &&
								<Prompt when={this.props.runningOrder.active || false} message={t('This running order is now active. Are you sure you want to exit this screen?')} />
							}
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
						<ErrorBoundary>
							{ this.props.segments && this.props.segments.length > 0 && <AfterBroadcastForm
								runningOrder={this.props.runningOrder}
							/> }
						</ErrorBoundary>
						<ErrorBoundary>
							<InspectorDrawer
								segments={this.props.segments}
								hotkeys={this.state.usedHotkeys}
								runningOrder={this.props.runningOrder}
								showStyleBase={this.props.showStyleBase}
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

function disableInInputFields (e: KeyboardEvent) {
	// @ts-ignore localName
	return (e && e.target && ['textarea', 'input'].indexOf(e.target.localName + '') !== -1 )
}
