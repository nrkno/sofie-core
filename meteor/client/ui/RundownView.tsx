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
import * as Escape from 'react-escape'
import Moment from 'react-moment'
import { NavLink, Route, Prompt } from 'react-router-dom'
import { PlayoutAPI } from '../../lib/api/playout'
import { Rundown, Rundowns, RundownHoldState } from '../../lib/collections/Rundowns'
import { Segment, Segments } from '../../lib/collections/Segments'
import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'
import { Part, Parts } from '../../lib/collections/Parts'

import { ContextMenu, MenuItem, ContextMenuTrigger } from 'react-contextmenu'

import { RundownTimingProvider, withTiming, WithTiming } from './RundownView/RundownTiming'
import { SegmentTimelineContainer, PieceUi } from './SegmentTimeline/SegmentTimelineContainer'
import { SegmentContextMenu } from './SegmentTimeline/SegmentContextMenu'
import { InspectorDrawer, InspectorDrawerBase, InspectorDrawerProps, InspectorPanelTabs } from './InspectorDrawer/InspectorDrawer'
import { RundownOverview } from './RundownView/RundownOverview'
import { RundownSystemStatus } from './RundownView/RundownSystemStatus'

import { getCurrentTime } from '../../lib/lib'
import { RundownUtils } from '../lib/rundown'

import * as mousetrap from 'mousetrap'
import { ErrorBoundary } from '../lib/ErrorBoundary'
import { ModalDialog, doModalDialog, isModalShowing } from '../lib/ModalDialog'
import { DEFAULT_DISPLAY_DURATION } from '../../lib/Rundown'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { getStudioMode, getDeveloperMode } from '../lib/localStorage'
import { scrollToPart, scrollToPosition, scrollToSegment } from '../lib/viewPort'
import { AfterBroadcastForm } from './AfterBroadcastForm'
import { Tracker } from 'meteor/tracker'
import { RundownFullscreenControls } from './RundownView/RundownFullscreenControls'
import { mousetrapHelper } from '../lib/mousetrapHelper'
import { ShowStyleBases, ShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { PeripheralDevicesAPI } from '../lib/clientAPI'
import { RONotificationEvent, onRONotificationClick as rundownNotificationHandler, RundownNotifier, reloadRundownClick } from './RundownView/RundownNotifier'
import { NotificationCenterPanel } from '../lib/notifications/NotificationCenterPanel'
import { NotificationCenter, NoticeLevel, Notification } from '../lib/notifications/notifications'
import { SupportPopUp } from './SupportPopUp'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { doUserAction } from '../lib/userAction'
import { UserActionAPI } from '../../lib/api/userActions'
import { ClipTrimPanel } from './ClipTrimPanel/ClipTrimPanel'
import { VTContent, VTEditableParameters } from 'tv-automation-sofie-blueprints-integration'
import { ClipTrimDialog } from './ClipTrimPanel/ClipTrimDialog'
import { NoteType } from '../../lib/api/notes'

type WrappedInspectorDrawer = InspectorDrawerBase & { getWrappedInstance (): InspectorDrawerBase }

interface IKeyboardFocusMarkerState {
	inFocus: boolean
}
interface IKeyboardFocusMarkerProps {
}
class KeyboardFocusMarker extends React.Component<IKeyboardFocusMarkerProps, IKeyboardFocusMarkerState> {
	keyboardFocusInterval: number

	constructor (props: IKeyboardFocusMarkerProps) {
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
				<div className='rundown-view__focus-lost-frame'></div>
			)
		}
	}
}

interface ITimingWarningProps {
	rundown: Rundown
	inActiveROView?: boolean
	studioMode: boolean
	oneMinuteBeforeAction: (e: Event) => void
}

interface ITimingWarningState {
	plannedStartCloseShown?: boolean
	plannedStartCloseShow?: boolean
}

const WarningDisplay = translate()(timer(5000)(
	class extends React.Component<Translated<ITimingWarningProps>, ITimingWarningState> {
		private REHEARSAL_MARGIN = 1 * 60 * 1000

		constructor (props: Translated<ITimingWarningProps>) {
			super(props)

			this.state = {}
		}

		componentDidUpdate (prevProps: ITimingWarningProps) {
			if ((this.props.rundown.active && !prevProps.rundown.active && this.props.rundown.rehearsal) ||
				(this.props.rundown.rehearsal !== prevProps.rundown.rehearsal)) {
				this.setState({
					plannedStartCloseShown: false
				})
			}

			if (this.props.rundown.active && this.props.rundown.rehearsal && this.props.rundown.expectedStart &&
				// the expectedStart is near
				getCurrentTime() + this.REHEARSAL_MARGIN > this.props.rundown.expectedStart &&
				// but it's not horribly in the past
				getCurrentTime() < this.props.rundown.expectedStart + (this.props.rundown.expectedDuration || 60 * 60 * 1000) &&
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

			if (!this.props.rundown) return null

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
						this.props.rundown.active &&
						!this.props.rundown.rehearsal
					) &&
					this.props.rundown.active
				}
			>
				<p>{t('You are in rehearsal mode, the broadcast starts in less than 1 minute. Do you want to reset the rundown and go into playout mode?')}</p>
			</ModalDialog>
		}
	}
) as React.StatelessComponent<Translated<ITimingWarningProps>>)

interface ITimingDisplayProps {
	rundown: Rundown
}

export enum RundownViewKbdShortcuts {
	RUNDOWN_TAKE = 'f12',
	RUNDOWN_TAKE2 = 'enter', // is only going to use the rightmost enter key for take
	RUNDOWN_HOLD = 'h',
	RUNDOWN_ACTIVATE = '§',
	RUNDOWN_ACTIVATE2 = '\\',
	RUNDOWN_ACTIVATE3 = '|',
	RUNDOWN_ACTIVATE_REHEARSAL = 'mod+§',
	RUNDOWN_DEACTIVATE = 'mod+shift+§',
	RUNDOWN_GO_TO_LIVE = 'mod+home',
	RUNDOWN_REWIND_SEGMENTS = 'shift+home',
	RUNDOWN_RESET_RUNDOWN = 'mod+shift+f12',
	RUNDOWN_RESET_RUNDOWN2 = 'mod+shift+enter',
	RUNDOWN_TOGGLE_DRAWER = 'tab',
	ADLIB_QUEUE_MODIFIER = 'shift',
	RUNDOWN_NEXT_FORWARD = 'f9',
	RUNDOWN_NEXT_DOWN = 'f10',
	RUNDOWN_NEXT_BACK = 'shift+f9',
	RUNDOWN_NEXT_UP = 'shift+f10',
	RUNDOWN_DISABLE_NEXT_ELEMENT = 'g',
	RUNDOWN_UNDO_DISABLE_NEXT_ELEMENT = 'shift+g',
	RUNDOWN_LOG_ERROR	= 'backspace'
}

const TimingDisplay = translate()(withTiming<ITimingDisplayProps, {}>()(
class extends React.Component<Translated<WithTiming<ITimingDisplayProps>>> {
	render () {
		const { t } = this.props

		if (!this.props.rundown) return null

		return (
			<div className='timing mod'>
				{ this.props.rundown.startedPlayback && (this.props.rundown.active && !this.props.rundown.rehearsal) ?
					<span className='timing-clock plan-start left'>
						<span className='timing-clock-label left'>{t('Started')}</span>
						<Moment interval={0} format='HH:mm:ss' date={this.props.rundown.startedPlayback} />
					</span> :
					<span className='timing-clock plan-start left'>
						<span className='timing-clock-label left'>{t('Planned Start')}</span>
						<Moment interval={0} format='HH:mm:ss' date={this.props.rundown.expectedStart} />
					</span>
				}
				{ this.props.rundown.startedPlayback && (this.props.rundown.active && !this.props.rundown.rehearsal) ?
					this.props.rundown.expectedStart &&
						<span className='timing-clock countdown playback-started left'>
							<span className='timing-clock-label left hide-overflow rundown-name' title={this.props.rundown.name}>{this.props.rundown.name}</span>
							{RundownUtils.formatDiffToTimecode(this.props.rundown.startedPlayback - this.props.rundown.expectedStart, true, false, true, true, true)}
						</span>
					:
					this.props.rundown.expectedStart &&
						<span className={ClassNames('timing-clock countdown plan-start left', {
							'heavy': getCurrentTime() > this.props.rundown.expectedStart
						})}>
							<span className='timing-clock-label left hide-overflow rundown-name' title={this.props.rundown.name}>{this.props.rundown.name}</span>
							{RundownUtils.formatDiffToTimecode(getCurrentTime() - this.props.rundown.expectedStart, true, false, true, true, true)}
						</span>
				}
				<span className='timing-clock time-now'>
					<Moment interval={0} format='HH:mm:ss' date={getCurrentTime()} />
					{this.props.rundown.holdState && this.props.rundown.holdState !== RundownHoldState.COMPLETE ?
						<div className='rundown__header-status rundown__header-status--hold'>{t('Hold')}</div>
						: null
					}
				</span>
				{ this.props.rundown.expectedDuration ?
					(<React.Fragment>
						{this.props.rundown.expectedStart && this.props.rundown.expectedDuration &&
							<span className='timing-clock plan-end right visual-last-child'>
								<span className='timing-clock-label right'>{t('Planned End')}</span>
								<Moment interval={0} format='HH:mm:ss' date={this.props.rundown.expectedStart + this.props.rundown.expectedDuration} />
							</span>
						}
						{this.props.rundown.expectedStart && this.props.rundown.expectedDuration &&
							<span className='timing-clock countdown plan-end right'>
								{RundownUtils.formatDiffToTimecode(getCurrentTime() - (this.props.rundown.expectedStart + this.props.rundown.expectedDuration), true, true, true)}
							</span>
						}
						{this.props.rundown.expectedDuration &&
							<span className={ClassNames('timing-clock heavy-light right', {
								'heavy': (this.props.timingDurations.asPlayedRundownDuration || 0) < (this.props.rundown.expectedDuration || 0),
								'light': (this.props.timingDurations.asPlayedRundownDuration || 0) > (this.props.rundown.expectedDuration || 0)
							})}>
								<span className='timing-clock-label right'>{t('Diff')}</span>
								{RundownUtils.formatDiffToTimecode((this.props.timingDurations.asPlayedRundownDuration || 0) - this.props.rundown.expectedDuration, true, false, true, true, true, undefined, true)}
							</span>
						}
					</React.Fragment>) :
					(<React.Fragment>
						{this.props.timingDurations ?
							<span className='timing-clock plan-end right visual-last-child'>
								<span className='timing-clock-label right'>{t('Expected End')}</span>
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

interface IRundownHeaderProps {
	rundown: Rundown,
	studioInstallation: StudioInstallation,
	onActivate?: (isRehearsal: boolean) => void,
	onRegisterHotkeys?: (hotkeys: Array<HotkeyDefinition>) => void
	studioMode: boolean
	inActiveROView?: boolean
}

interface IRundownHeaderState {
	isError: boolean,
	errorMessage?: string
}

const RundownHeader = translate()(class extends React.Component<Translated<IRundownHeaderProps>, IRundownHeaderState> {
	bindKeys: Array<{
		key: string,
		up?: (e: KeyboardEvent) => any
		down?: (e: KeyboardEvent) => any
		label: string
		global?: boolean
		coolDown?: number
	}> = []
	constructor (props: Translated<IRundownHeaderProps>) {
		super(props)

		const { t } = props
		if (this.props.studioMode) {
			this.bindKeys = [
				{
					key: RundownViewKbdShortcuts.RUNDOWN_TAKE,
					up: this.keyTake,
					label: t('Take'),
					global: true
				},{
					key: RundownViewKbdShortcuts.RUNDOWN_TAKE2,
					up: this.keyTake,
					label: t('Take'),
					global: true
				},{
					key: RundownViewKbdShortcuts.RUNDOWN_HOLD,
					up: this.keyHold,
					label: t('Hold')
				},{
					key: RundownViewKbdShortcuts.RUNDOWN_ACTIVATE,
					up: this.keyActivate,
					label: t('Activate'),
					global: true
				},{
					key: RundownViewKbdShortcuts.RUNDOWN_ACTIVATE2,
					up: this.keyActivate,
					label: t('Activate'),
					global: true
				},{
					key: RundownViewKbdShortcuts.RUNDOWN_ACTIVATE3,
					up: this.keyActivate,
					label: t('Activate'),
					global: true
				},{
					key: RundownViewKbdShortcuts.RUNDOWN_DEACTIVATE,
					up: this.keyDeactivate,
					label: t('Deactivate'),
					global: true
				},{
					key: RundownViewKbdShortcuts.RUNDOWN_ACTIVATE_REHEARSAL,
					up: this.keyActivateRehearsal,
					label: t('Activate (Rehearsal)'),
					global: true
				},{
					key: RundownViewKbdShortcuts.RUNDOWN_RESET_RUNDOWN,
					up: this.keyResetRundown,
					label: t('Reload Rundown'),
					global: true
				},{
					key: RundownViewKbdShortcuts.RUNDOWN_RESET_RUNDOWN2,
					up: this.keyResetRundown,
					label: t('Reload Rundown'),
					global: true
				},{
					key: RundownViewKbdShortcuts.RUNDOWN_NEXT_FORWARD,
					up: this.keyMoveNextForward,
					label: t('Move Next forwards'),
					global: true
				},
				{
					key: RundownViewKbdShortcuts.RUNDOWN_NEXT_DOWN,
					up: this.keyMoveNextDown,
					label: t('Move Next to the following segment'),
					global: true
				},
				{
					key: RundownViewKbdShortcuts.RUNDOWN_NEXT_UP,
					up: this.keyMoveNextUp,
					label: t('Move Next to the previous segment'),
					global: true
				},
				{
					key: RundownViewKbdShortcuts.RUNDOWN_NEXT_BACK,
					up: this.keyMoveNextBack,
					label: t('Move Next backwards'),
					global: true
				},
				{
					key: RundownViewKbdShortcuts.RUNDOWN_DISABLE_NEXT_ELEMENT,
					up: this.keyDisableNextPiece,
					label: t('Disable the next element'),
					global: true
				},
				{
					key: RundownViewKbdShortcuts.RUNDOWN_UNDO_DISABLE_NEXT_ELEMENT,
					up: this.keyDisableNextPieceUndo,
					label: t('Undo Disable the next element'),
					global: true
				},
				{
					key: RundownViewKbdShortcuts.RUNDOWN_LOG_ERROR,
					up: this.keyLogError,
					label: t('Log Error'),
					global: true,
					coolDown: 1000
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

		let preventDefault = (e: Event) => {
			e.preventDefault()
			e.stopImmediatePropagation()
			e.stopPropagation()
		}
		_.each(this.bindKeys, (k) => {
			const method = k.global ? mousetrapHelper.bindGlobal : mousetrapHelper.bind
			let lastUsed = Date.now()
			if (k.up) {
				method(k.key, (e: KeyboardEvent) => {
					preventDefault(e)
					if (k.coolDown && lastUsed > Date.now() - k.coolDown) return
					if (k.up) k.up(e)
					lastUsed = Date.now()
				}, 'keyup', 'RundownHeader')
				method(k.key, (e: KeyboardEvent) => {
					preventDefault(e)
				}, 'keydown', 'RundownHeader')
			}
			if (k.down) {
				method(k.key, (e: KeyboardEvent) => {
					preventDefault(e)
					if (k.coolDown && lastUsed > Date.now() - k.coolDown) return
					if (k.down) k.down(e)
					lastUsed = Date.now()
				}, 'keydown', 'RundownHeader')
			}
		})

		if (typeof this.props.onRegisterHotkeys === 'function') {
			this.props.onRegisterHotkeys(this.bindKeys)
		}

		reloadRundownClick.set(this.reloadRundown)
	}

	componentWillUnmount () {
		_.each(this.bindKeys, (k) => {
			if (k.up) {
				mousetrapHelper.unbind(k.key, 'RundownHeader', 'keyup')
				mousetrapHelper.unbind(k.key, 'RundownHeader', 'keydown')
			}
			if (k.down) {
				mousetrapHelper.unbind(k.key, 'RundownHeader', 'keydown')
			}
		})
	}
	keyTake = (e: ExtendedKeyboardEvent) => {
		if (e.key !== 'Enter' || e.location === 3) { // only allow the rightmost enter key
			if (!isModalShowing()) this.take(e)
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
	keyResetRundown = (e: ExtendedKeyboardEvent) => {
		this.resetRundown(e)
	}
	keyReloadRundown = (e: ExtendedKeyboardEvent) => {
		this.reloadRundown(e)
	}
	keyMoveNextForward = (e: ExtendedKeyboardEvent) => {
		// "forward" = to next Part
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
	keyDisableNextPiece = (e: ExtendedKeyboardEvent) => {
		this.disableNextPiece(e)
	}
	keyDisableNextPieceUndo = (e: ExtendedKeyboardEvent) => {
		this.disableNextPieceUndo(e)
	}
	keyLogError = (e: ExtendedKeyboardEvent) => {
		this.takeRundownSnapshot(e)
	}

	disableNextPiece = (e: any) => {
		const { t } = this.props

		if (this.props.studioMode) {
			doUserAction(t, e, UserActionAPI.methods.disableNextPiece, [this.props.rundown._id, false])
		}
	}

	disableNextPieceUndo = (e: any) => {
		const {t} = this.props

		if (this.props.studioMode) {
			doUserAction(t, e, UserActionAPI.methods.disableNextPiece, [this.props.rundown._id, true])
		}
	}

	take = (e: any) => {
		const {t} = this.props
		if (this.props.studioMode) {
			doUserAction(t, e, UserActionAPI.methods.take, [this.props.rundown._id])
		}
	}
	moveNext = (e: any, horizonalDelta: number, verticalDelta: number) => {
		const {t} = this.props
		if (this.props.studioMode) {
			if (this.props.rundown.active) {
				doUserAction(t, e, UserActionAPI.methods.moveNext, [this.props.rundown._id, horizonalDelta, verticalDelta], (err, response) => {
					if (!err && response) {
						const partId = response.result
						if (partId) scrollToPart(partId)
					}
				})
			}
		}
	}

	discardError = () => {
		this.setState({
			isError: false
		})
	}

	hold = (e: any) => {
		const {t} = this.props
		if (this.props.studioMode && this.props.rundown.active) {
			doUserAction(t, e, UserActionAPI.methods.activateHold, [this.props.rundown._id])
		}
	}
	rundownShouldHaveStarted () {
		return getCurrentTime() > (this.props.rundown.expectedStart || 0)
	}
	rundownShouldHaveEnded () {
		return getCurrentTime() > (this.props.rundown.expectedStart || 0) + (this.props.rundown.expectedDuration || 0)
	}

	activate = (e: any) => {
		const { t } = this.props
		if (e.persist) e.persist()

		if (
			this.props.studioMode &&
			(
				!this.props.rundown.active ||
				(
					this.props.rundown.active &&
					this.props.rundown.rehearsal
				)
			)
		) {
			let doActivate = (le: any) => {
				doUserAction(t, e, UserActionAPI.methods.activate, [this.props.rundown._id, false], (err, response) => {
					if (!err) {
						if (typeof this.props.onActivate === 'function') this.props.onActivate(false)
					}
				})
			}
			if (!this.rundownShouldHaveStarted() ) {
				// The broadcast hasn't started yet
				doModalDialog({
					title: this.props.rundown.name,
					message: t('Do you want to activate this Rundown?'),
					onAccept: (le: any) => {
						this.rewindSegments()
						doUserAction(t, e, UserActionAPI.methods.resetAndActivate, [this.props.rundown._id], (err, response) => {
							if (!err) {
								this.deferFlushAndRewindSegments()
								if (typeof this.props.onActivate === 'function') this.props.onActivate(false)
							}
						})
					}
				})
			} else if (!this.rundownShouldHaveEnded() ) {
				// The broadcast has started
				doActivate(e)
			} else {
				// The broadcast has ended, going into active mode is probably not what you want to do
				doModalDialog({
					title: this.props.rundown.name,
					message: t('The planned end time has passed, are you sure you want to activate this Rundown?'),
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
				!this.props.rundown.active ||
				(
					this.props.rundown.active &&
					!this.props.rundown.rehearsal
				)
			)
		) {
			let doActivateRehersal = () => {
				doUserAction(t, e, UserActionAPI.methods.activate, [this.props.rundown._id, true], (err, response) => {
					if (!err) {
						if (typeof this.props.onActivate === 'function') this.props.onActivate(false)
					}
				})
			}
			if (!this.rundownShouldHaveStarted()) {
				// The broadcast hasn't started yet
				if (!this.props.rundown.active) {
					// inactive, do the full preparation:
					doUserAction(t, e, UserActionAPI.methods.prepareForBroadcast, [this.props.rundown._id], (err, response) => {
						if (!err) {
							if (typeof this.props.onActivate === 'function') this.props.onActivate(false)
						}
					})
				} else if (!this.props.rundown.rehearsal) {
					// Active, and not in rehearsal
					doModalDialog({
						title: this.props.rundown.name,
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
				if (!this.rundownShouldHaveEnded()) {
					// We are in the broadcast
					doModalDialog({
						title: this.props.rundown.name,
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

		if (this.props.studioMode && this.props.rundown.active) {
			if (this.rundownShouldHaveStarted()) {
				if (this.props.rundown.rehearsal) {
					// We're in rehearsal mode
					doUserAction(t, e, UserActionAPI.methods.deactivate, [this.props.rundown._id])
				} else {
					doModalDialog({
						title: this.props.rundown.name,
						message: t('Are you sure you want to deactivate this Rundown?\n(This will clear the outputs)'),
						onAccept: () => {
							doUserAction(t, e, UserActionAPI.methods.deactivate, [this.props.rundown._id])
						}
					})
				}
			} else {
				// Do it right away
				doUserAction(t, e, UserActionAPI.methods.deactivate, [this.props.rundown._id])
			}
		}
	}

	resetRundown = (e: any) => {
		const { t } = this.props
		if (e.persist) e.persist()

		let doReset = () => {
			this.rewindSegments() // Do a rewind right away
			doUserAction(t, e, UserActionAPI.methods.resetRundown, [this.props.rundown._id], () => {
				this.deferFlushAndRewindSegments()
			})
		}
		if ((this.props.rundown.active && !this.props.rundown.rehearsal)) {
			// The rundown is active and not in rehersal
			doModalDialog({
				title: this.props.rundown.name,
				message: t('The rundown can not be reset while it is active'),
				onAccept: () => {
					// nothing
				},
				acceptOnly: true,
				yes: 'OK'
			})
		} else {
			doReset()
		}
	}

	reloadRundown = (e: any, changeRehearsal?: boolean) => {
		const { t } = this.props
		if (this.props.studioMode) {
			doUserAction(t, e, UserActionAPI.methods.reloadData, [this.props.rundown._id, changeRehearsal], (err) => {
				if (!err) {
					if (this.props.rundown && this.props.rundown.nextPartId) {
						scrollToPart(this.props.rundown.nextPartId)
					}
				}
			})
		}
	}

	takeRundownSnapshot = (e) => {
		const {t} = this.props
		if (this.props.studioMode) {
			doUserAction(t, e, UserActionAPI.methods.storeRundownSnapshot, [this.props.rundown._id, 'Taken by user'], undefined,
				t('A snapshot of the current Running\xa0Order has been created for troubleshooting.'))
		}
	}

	resetAndActivateRundown = (e: any) => {
		// Called from the ModalDialog, 1 minute before broadcast starts
		if (this.props.studioMode) {
			const {t} = this.props
			this.rewindSegments() // Do a rewind right away

			doUserAction(t, e, UserActionAPI.methods.resetAndActivate, [this.props.rundown._id], (err) => {
				if (!err) {
					this.deferFlushAndRewindSegments()
					if (typeof this.props.onActivate === 'function') this.props.onActivate(false)
				}
			})
		}
	}

	rewindSegments () {
		window.dispatchEvent(new Event(RundownViewEvents.rewindsegments))
	}
	deferFlushAndRewindSegments () {
		// Do a rewind later, when the UI has updated
		Meteor.defer(() => {
			Tracker.flush()
			Meteor.setTimeout(() => {
				window.dispatchEvent(new Event(RundownViewEvents.rewindsegments))
				window.dispatchEvent(new Event(RundownViewEvents.goToTop))
			}, 500)
		})
	}

	render () {
		const { t } = this.props
		return <React.Fragment>
			<Escape to='document'>
				<ContextMenu id='rundown-context-menu'>
					<div className='react-contextmenu-label'>
						{this.props.rundown && this.props.rundown.name}
					</div>
					{
						this.props.studioMode ?
							<React.Fragment>
								{
									!(this.props.rundown.active && this.props.rundown.rehearsal) ?
										(
											!this.rundownShouldHaveStarted() && !this.props.rundown.active ?
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
									this.props.rundown.active ?
										<MenuItem onClick={(e) => this.deactivate(e)}>
											{t('Deactivate')}
										</MenuItem> :
										null
								}
								{
									this.props.rundown.active ?
										<MenuItem onClick={(e) => this.take(e)}>
											{t('Take')}
										</MenuItem> :
										null
								}
								{
									this.props.rundown.active ?
										<MenuItem onClick={(e) => this.hold(e)}>
											{t('Hold')}
										</MenuItem> :
										null
								}
								{
									!(this.props.rundown.active && !this.props.rundown.rehearsal) ?
										<MenuItem onClick={(e) => this.resetRundown(e)}>
											{t('Reset Rundown')}
										</MenuItem> :
										null
								}
								<MenuItem onClick={(e) => this.reloadRundown(e)}>
									{t('Reload ENPS Data')}
								</MenuItem>
								<MenuItem onClick={(e) => this.takeRundownSnapshot(e)}>
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
			</Escape>
			<div className={ClassNames('header rundown', {
				'active': this.props.rundown.active,
				'not-active': !this.props.rundown.active,

				'rehearsal': this.props.rundown.rehearsal
			})}>
				<ContextMenuTrigger id='rundown-context-menu' attributes={{
					className: 'flex-col col-timing horizontal-align-center'
				}}>
					<WarningDisplay
						studioMode={this.props.studioMode}
						inActiveROView={this.props.inActiveROView}
						rundown={this.props.rundown}
						oneMinuteBeforeAction={this.resetAndActivateRundown}
					/>
					<div className='row first-row super-dark'>
						<div className='flex-col left horizontal-align-left'>
							<div className='badge mod'>
								<div className='media-elem mrs sofie-logo' />
								<div className='bd mls'><span className='logo-text'></span></div>
							</div>
						</div>
						<div className='flex-col right horizontal-align-right'>
							<div className='links mod close'>
								<NavLink to='/rundowns'>
									<CoreIcon id='nrk-close' />
								</NavLink>
							</div>
						</div>
						<TimingDisplay {...this.props} />
						{this.props.studioInstallation && <RundownSystemStatus studioInstallation={this.props.studioInstallation} rundown={this.props.rundown} />}
					</div>
					<div className='row dark'>
						<div className='col c12 rundown-overview'>
							{ this.props.rundown && <RundownOverview rundownId={this.props.rundown._id} /> }
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
			rundownId: string
		}
	}
	rundownId?: string
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
	isNotificationsCenterOpen: boolean
	isSupportPanelOpen: boolean
	isInspectorDrawerExpanded: boolean
	isClipTrimmerOpen: boolean
	selectedPiece: PieceUi | undefined
}

export enum RundownViewEvents {
	'rewindsegments'	=	'sofie:rundownRewindSegments',
	'goToLiveSegment'	=	'sofie:goToLiveSegment',
	'goToTop'			=	'sofie:goToTop'
}

interface ITrackedProps {
	rundownId: string
	rundown?: Rundown
	segments: Array<Segment>
	studioInstallation?: StudioInstallation
	showStyleBase?: ShowStyleBase
}
export const RundownView = translateWithTracker<IProps, IState, ITrackedProps>((props: IProps, state) => {

	let rundownId
	if (props.match && props.match.params.rundownId) {
		rundownId = decodeURIComponent(props.match.params.rundownId)
	} else if (props.rundownId) {
		rundownId = props.rundownId
	}

	let rundown = Rundowns.findOne({ _id: rundownId })
	let studioInstallation = rundown && StudioInstallations.findOne({ _id: rundown.studioInstallationId })
	// let rundownDurations = calculateDurations(rundown, parts)
	return {
		rundownId: rundownId,
		rundown: rundown,
		segments: rundown ? Segments.find({ rundownId: rundown._id }, {
			sort: {
				'_rank': 1
			}
		}).fetch() : [],
		studioInstallation: studioInstallation,
		showStyleBase: rundown && ShowStyleBases.findOne(rundown.showStyleBaseId)
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
	private _inspectorDrawer: WrappedInspectorDrawer | null

	constructor (props: Translated<IProps & ITrackedProps>) {
		super(props)

		const { t } = this.props

		this.bindKeys = [
			{
				key: RundownViewKbdShortcuts.RUNDOWN_GO_TO_LIVE,
				up: this.onGoToLiveSegment,
				label: t('Go to On Air line'),
				global: true
			},
			{
				key: RundownViewKbdShortcuts.RUNDOWN_REWIND_SEGMENTS,
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
			isNotificationsCenterOpen: false,
			isSupportPanelOpen: false,
			isInspectorDrawerExpanded: false,
			isClipTrimmerOpen: false,
			selectedPiece: undefined
		}
	}

	componentWillMount () {
		// Subscribe to data:
		let rundownId = this.props.rundownId

		this.subscribe('rundowns', {
			_id: rundownId
		})
		this.subscribe('segments', {
			rundownId: rundownId
		})
		this.subscribe('parts', {
			rundownId: rundownId
		})
		this.subscribe('pieces', {
			rundownId: rundownId
		})
		this.subscribe('adLibPieces', {
			rundownId: rundownId
		})
		this.autorun(() => {
			let rundown = Rundowns.findOne(rundownId)
			if (rundown) {
				this.subscribe('studioInstallations', {
					_id: rundown.studioInstallationId
				})
				this.subscribe('showStyleBases', {
					_id: rundown.showStyleBaseId
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

		rundownNotificationHandler.set(this.onRONotificationClick)

		window.addEventListener(RundownViewEvents.goToLiveSegment, this.onGoToLiveSegment)
		window.addEventListener(RundownViewEvents.goToTop, this.onGoToTop)
	}

	componentDidUpdate (prevProps: IProps & ITrackedProps, prevState: IState) {
		if (this.props.rundown &&
			prevProps.rundown && prevProps.rundown.currentPartId !== this.props.rundown.currentPartId &&
			this.state.manualSetAsNext) {

			this.setState({
				manualSetAsNext: false,
				followLiveSegments: true
			})
		} else if (this.props.rundown &&
			prevProps.rundown && prevProps.rundown.active && !this.props.rundown.active) {
			this.setState({
				followLiveSegments: true
			})
		} else if (this.props.rundown &&
			prevProps.rundown && !prevProps.rundown.active && this.props.rundown.active &&
			this.props.rundown.nextPartId) {
			scrollToPart(this.props.rundown.nextPartId)
		}

		if (typeof this.props.rundown !== typeof this.props.rundown ||
			(this.props.rundown || {_id: ''})._id !== (prevProps.rundown || {_id: ''})._id ||
			(this.props.rundown || {active: false}).active !== (prevProps.rundown || {active: false}).active ||
			this.state.studioMode !== prevState.studioMode) {
			if (this.props.rundown && this.props.rundown.active && this.state.studioMode && !getDeveloperMode()) {
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
		const {t} = this.props
		let preventDefault = (e) => {
			e.preventDefault()
			e.stopImmediatePropagation()
			e.stopPropagation()
		}
		const noOp = (e) => {
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
		this.usedArgumentKeys = []

		if (this.props.showStyleBase) {
			_.each(this.props.showStyleBase.runtimeArguments, (i) => {
				const combos = i.hotkeys.split(',')
				_.each(combos, (combo: string) => {
					const handler = (e: KeyboardEvent) => {
						if (this.props.rundown && this.props.rundown.active && this.props.rundown.nextPartId) {
							doUserAction(t, e, UserActionAPI.methods.togglePartArgument, [
								this.props.rundown._id, this.props.rundown.nextPartId, i.property, i.value
							])
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

	onSelectPiece = (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => {
		if (piece && piece.content && (piece.content as VTContent).editable &&
			((((piece.content as VTContent).editable as VTEditableParameters).editorialDuration !== undefined) ||
			((piece.content as VTContent).editable as VTEditableParameters).editorialStart !== undefined)) {
			this.setState({
				isClipTrimmerOpen: true,
				selectedPiece: piece

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

		window.removeEventListener(RundownViewEvents.goToLiveSegment, this.onGoToLiveSegment)
		window.removeEventListener(RundownViewEvents.goToTop, this.onGoToTop)
	}

	onBeforeUnload = (e: any) => {
		const {t} = this.props

		e.preventDefault()
		e.returnValue = t('This rundown is now active. Are you sure you want to exit this screen?')

		return t('This rundown is now active. Are you sure you want to exit this screen?')
	}

	onRewindSegments = () => {
		window.dispatchEvent(new Event(RundownViewEvents.rewindsegments))
	}

	onTimeScaleChange = (timeScaleVal) => {
		if (Number.isFinite(timeScaleVal) && timeScaleVal > 0) {
			this.setState({
				timeScale: timeScaleVal
			})
		}
	}

	onSegmentScroll = () => {
		if (this.state.followLiveSegments && this.props.rundown && this.props.rundown.active) {
			this.setState({
				followLiveSegments: false
			})
		}
	}

	onWindowScroll = (e: JQuery.Event) => {
		const isAutoScrolling = $(document.body).hasClass('auto-scrolling')
		if (this.state.followLiveSegments && !isAutoScrolling && this.props.rundown && this.props.rundown.active) {
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
		if (this.props.rundown && this.props.rundown.active && !this.props.rundown.currentPartId &&
			this.props.rundown.nextPartId) {
			this.setState({
				followLiveSegments: true
			})
			scrollToPart(this.props.rundown.nextPartId)
			// allow for the scroll to finish
			Meteor.setTimeout(() => {
				this.setState({
					followLiveSegments: true
				})
				window.dispatchEvent(new Event(RundownViewEvents.rewindsegments))
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

	onSetNext = (part: Part, e: any, offset?: number) => {
		const {t} = this.props
		if (this.state.studioMode && part && part._id && this.props.rundown) {
			doUserAction(t, e, UserActionAPI.methods.setNext, [this.props.rundown._id, part._id, offset], () => {
				this.setState({
					manualSetAsNext: true
				})
			})
		}
	}

	onPieceDoubleClick = (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => {
		const {t} = this.props
		if (this.state.studioMode && item && item._id && this.props.rundown && this.props.rundown.currentPartId) {
			doUserAction(t, e, UserActionAPI.methods.pieceTakeNow, [this.props.rundown._id, this.props.rundown.currentPartId, item._id])
		}
	}

	onRONotificationClick = (e: RONotificationEvent) => {
		if (e.sourceLocator) {
			let segmentId = e.sourceLocator.segmentId

			if (!segmentId) {
				if (e.sourceLocator.partId) {
					let part = Parts.findOne(e.sourceLocator.partId)
					if (part) {
						segmentId = part.segmentId
					}
				}
			}
			if (segmentId) {
				scrollToSegment(segmentId)
			}
		}
	}
	onHeaderNoteClick = (segmentId: string, level: NoteType) => {
		NotificationCenter.snoozeAll()
		const isOpen = this.state.isNotificationsCenterOpen
		this.setState({
			isNotificationsCenterOpen: true
		})
		setTimeout(function () {
			NotificationCenter.highlightSource(segmentId, level === NoteType.ERROR ? NoticeLevel.CRITICAL : NoticeLevel.WARNING)
		}, isOpen ? 1 : 1000)
	}

	onToggleSupportPanel = (e: React.MouseEvent<HTMLDivElement>) => {
		this.setState({
			isSupportPanelOpen: !this.state.isSupportPanelOpen
		})
	}

	renderSegments () {
		if (this.props.segments) {
			return this.props.segments.map((segment, index, array) => {
				if (
					this.props.studioInstallation &&
					this.props.rundown &&
					this.props.showStyleBase
				) {
					return <ErrorBoundary key={segment._id}>
							<SegmentTimelineContainer
								studioInstallation={this.props.studioInstallation}
								showStyleBase={this.props.showStyleBase}
								followLiveSegments={this.state.followLiveSegments}
								segmentId={segment._id}
								rundown={this.props.rundown}
								liveLineHistorySize={100}
								timeScale={this.state.timeScale}
								onTimeScaleChange={this.onTimeScaleChange}
								onContextMenu={this.onContextMenu}
								onSegmentScroll={this.onSegmentScroll}
								isLastSegment={index === array.length - 1}
								onItemClick={this.onSelectPiece}
								onItemDoubleClick={this.onPieceDoubleClick}
								onHeaderNoteClick={(level) => this.onHeaderNoteClick(segment._id, level)}
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

		if (this.props.rundown) {
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
		if (!this.state.isNotificationsCenterOpen === true) {
			NotificationCenter.snoozeAll()
			NotificationCenter.highlightSource(undefined, NoticeLevel.CRITICAL)
		}

		this.setState({
			isNotificationsCenterOpen: !this.state.isNotificationsCenterOpen
		})
	}

	onToggleHotkeys = () => {
		if (!this.state.isInspectorDrawerExpanded) {
			this.setState({
				isInspectorDrawerExpanded: true
			})
			if (this._inspectorDrawer) {
				this._inspectorDrawer.getWrappedInstance().switchTab(InspectorPanelTabs.SYSTEM_HOTKEYS)
			}
		} else {
			this.setState({
				isInspectorDrawerExpanded: false
			})
		}
	}

	onRestartPlayout = (e: React.MouseEvent<HTMLButtonElement>) => {
		const { t } = this.props

		if (this.props.studioInstallation) {
			const attachedPlayoutGateways = PeripheralDevices.find({
				studioInstallationId: this.props.studioInstallation._id,
				connected: true,
				type: PeripheralDeviceAPI.DeviceType.PLAYOUT
			}).fetch()
			if (attachedPlayoutGateways.length === 0) {
				NotificationCenter.push(new Notification(undefined, NoticeLevel.CRITICAL, t('There are no Playout\xa0Gateways connected and attached to this studio. Please contact the system administrator to start the Playout Gateway.'), 'RundownView'))
				return
			}
			attachedPlayoutGateways.forEach((item) => {
				PeripheralDevicesAPI.restartDevice(item, e).then(() => {
					NotificationCenter.push(new Notification(undefined, NoticeLevel.NOTIFICATION, t('Playout\xa0Gateway "{{playoutDeviceName}}" is now restarting.', {playoutDeviceName: item.name}), 'RundownView'))
				}).catch(() => {
					NotificationCenter.push(new Notification(undefined, NoticeLevel.CRITICAL, t('Could not restart Playout\xa0Gateway "{{playoutDeviceName}}".', {playoutDeviceName: item.name}), 'RundownView'))
				})
			})
		}
	}

	onTakeRundownSnapshot = (e: React.MouseEvent<HTMLButtonElement>) => {
		const { t } = this.props
		if (this.props.rundown) {
			doUserAction(t, e, UserActionAPI.methods.storeRundownSnapshot, [this.props.rundown._id, 'User requested log at' + getCurrentTime()], undefined,
				t('A snapshot of the current Running\xa0Order has been created for troubleshooting.'))
		}
	}

	onDrawerChangeExpanded = (value: boolean) => {
		this.setState({
			isInspectorDrawerExpanded: value
		})
	}

	setInspectorDrawer = (isp: WrappedInspectorDrawer | null) => {
		this._inspectorDrawer = isp
	}

	getStyle () {
		return {
			'marginBottom': this.state.bottomMargin
		}
	}

	render () {
		const { t } = this.props

		if (this.state.subsReady) {
			if (
				this.props.rundown &&
				this.props.studioInstallation &&
				this.props.showStyleBase
			) {
				return (
					<RundownTimingProvider
						rundown={this.props.rundown}
						defaultDuration={DEFAULT_DISPLAY_DURATION}>
						<div className={ClassNames('rundown-view', {
							'notification-center-open': this.state.isNotificationsCenterOpen
						})} style={this.getStyle()} onWheelCapture={this.onWheel} onContextMenu={this.onContextMenuTop}>
							<ErrorBoundary>
								{ this.state.studioMode && <KeyboardFocusMarker /> }
							</ErrorBoundary>
							<ErrorBoundary>
								<RundownFullscreenControls
									isFollowingOnAir={this.state.followLiveSegments}
									onFollowOnAir={this.onGoToLiveSegment}
									onRewindSegments={this.onRewindSegments}
									isNotificationCenterOpen={this.state.isNotificationsCenterOpen}
									onToggleNotifications={this.onToggleNotifications}
									isSupportPanelOpen={this.state.isSupportPanelOpen}
									onToggleSupportPanel={this.onToggleSupportPanel} />
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
									{this.state.isNotificationsCenterOpen && <NotificationCenterPanel />}
								</VelocityReact.VelocityTransitionGroup>
								<VelocityReact.VelocityTransitionGroup enter={{
									animation: {
										translateX: ['0%', '100%']
									}, easing: 'ease-out', duration: 300
								}} leave={{
									animation: {
										translateX: ['100%', '0%']
									}, easing: 'ease-in', duration: 500
								}}>
									{this.state.isSupportPanelOpen &&
										<SupportPopUp>
											<button className='btn btn-primary' onClick={this.onToggleHotkeys}>{t('Show Hotkeys')}</button>
											<button className='btn btn-primary' onClick={this.onTakeRundownSnapshot}>{t('Take a Snapshot')}</button>
											<button className='btn btn-primary' onClick={this.onRestartPlayout}>{t('Restart Playout')}</button>
										</SupportPopUp>
									}
								</VelocityReact.VelocityTransitionGroup>
							</ErrorBoundary>
							<ErrorBoundary>
								{ this.state.studioMode &&
									<Prompt when={this.props.rundown.active || false} message={t('This rundown is now active. Are you sure you want to exit this screen?')} />
								}
							</ErrorBoundary>
							<ErrorBoundary>
								<RundownHeader
									rundown={this.props.rundown}
									studioInstallation={this.props.studioInstallation}
									onActivate={this.onActivate}
									studioMode={this.state.studioMode}
									onRegisterHotkeys={this.onRegisterHotkeys}
									inActiveROView={this.props.inActiveROView} />
							</ErrorBoundary>
							<ErrorBoundary>
								<SegmentContextMenu
									contextMenuContext={this.state.contextMenuContext}
									rundown={this.props.rundown}
									onSetNext={this.onSetNext}
									studioMode={this.state.studioMode} />
							</ErrorBoundary>
							<ErrorBoundary>
								{this.state.isClipTrimmerOpen && this.state.selectedPiece && this.props.studioInstallation &&
									<ClipTrimDialog
										studioInstallation={this.props.studioInstallation}
										rundownId={this.props.rundownId}
										selectedPiece={this.state.selectedPiece}
										onClose={() => this.setState({ isClipTrimmerOpen: false })}
										/>
								}
							</ErrorBoundary>
							{this.renderSegmentsList()}
							<ErrorBoundary>
								{ this.props.segments && this.props.segments.length > 0 && <AfterBroadcastForm
									rundown={this.props.rundown}
								/> }
							</ErrorBoundary>
							<ErrorBoundary>
								<InspectorDrawer
									ref={this.setInspectorDrawer}
									isExpanded={this.state.isInspectorDrawerExpanded}
									onChangeExpanded={this.onDrawerChangeExpanded}
									segments={this.props.segments}
									hotkeys={this.state.usedHotkeys}
									rundown={this.props.rundown}
									showStyleBase={this.props.showStyleBase}
									studioMode={this.state.studioMode}
									onChangeBottomMargin={this.onChangeBottomMargin}
									onRegisterHotkeys={this.onRegisterHotkeys} />
							</ErrorBoundary>
							<ErrorBoundary>
								{this.props.rundown && this.props.studioInstallation && this.props.showStyleBase &&
									<RundownNotifier rundownId={this.props.rundown._id} studioInstallation={this.props.studioInstallation} showStyleBase={this.props.showStyleBase} />
								}
							</ErrorBoundary>
						</div>
						{// USE IN CASE OF DEBUGGING EMERGENCY
						/* getDeveloperMode() && <div id='debug-console' className='debug-console' style={{
							background: 'rgba(255,255,255,0.7)',
							color: '#000',
							position: 'fixed',
							top: '0',
							right: '0',
							zIndex: 10000,
							pointerEvents: 'none'
						}}>
						</div> */}
					</RundownTimingProvider>
				)
			} else {
				return (
					<div className='rundown-view rundown-view--unpublished'>
						<div className='rundown-view__label'>
							<p>
								{
									!this.props.rundown ?
										t('This rundown has been unpublished from Sofie.') :
									!this.props.studioInstallation ?
										t('Error: The studio of this Rundown was not found.') :
									!this.props.showStyleBase ?
										t('Error: The ShowStyle of this Rundown was not found.') :
									t('Unknown error')
								}
							</p>
							<p>
								<Route render={({history}) => (
									<button className='btn btn-primary' onClick={() => { history.push('/rundowns') }}>
										{t('Return to list')}
									</button>
								)} />
							</p>
						</div>
					</div>
				)
			}
		} else {
			return (
				<div className='rundown-view rundown-view--loading'>
					<Spinner />
				</div>
			)
		}
	}
}
)
