import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import { parse as queryStringParse } from 'query-string'
import * as VelocityReact from 'velocity-react'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { VTContent, VTEditableParameters } from 'tv-automation-sofie-blueprints-integration'
import { translate } from 'react-i18next'
import timer from 'react-timer-hoc'
import * as CoreIcon from '@nrk/core-icons/jsx'
import { Spinner } from '../lib/Spinner'
import * as ClassNames from 'classnames'
import * as _ from 'underscore'
import * as Escape from 'react-escape'
import * as i18next from 'i18next'
import Moment from 'react-moment'
const Tooltip = require('rc-tooltip')
import { NavLink, Route, Prompt, Switch } from 'react-router-dom'
import { Rundown, Rundowns, RundownHoldState } from '../../lib/collections/Rundowns'
import { Segment, Segments } from '../../lib/collections/Segments'
import { Studio, Studios } from '../../lib/collections/Studios'
import { Part, Parts } from '../../lib/collections/Parts'

import { ContextMenu, MenuItem, ContextMenuTrigger } from 'react-contextmenu'

import { RundownTimingProvider, withTiming, WithTiming } from './RundownView/RundownTiming'
import { SegmentTimelineContainer, PieceUi } from './SegmentTimeline/SegmentTimelineContainer'
import { SegmentContextMenu } from './SegmentTimeline/SegmentContextMenu'
import { Shelf, ShelfBase, ShelfTabs } from './Shelf/Shelf'
import { RundownOverview } from './RundownView/RundownOverview'
import { RundownSystemStatus } from './RundownView/RundownSystemStatus'

import { getCurrentTime } from '../../lib/lib'
import { RundownUtils } from '../lib/rundown'

import * as mousetrap from 'mousetrap'
import { ErrorBoundary } from '../lib/ErrorBoundary'
import { ModalDialog, doModalDialog, isModalShowing } from '../lib/ModalDialog'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { getAllowStudio, getAllowDeveloper, getHelpMode } from '../lib/localStorage'
import { ClientAPI } from '../../lib/api/client'
import { scrollToPart, scrollToPosition, scrollToSegment, maintainFocusOnPart } from '../lib/viewPort'
import { AfterBroadcastForm } from './AfterBroadcastForm'
import { Tracker } from 'meteor/tracker'
import { RundownFullscreenControls } from './RundownView/RundownFullscreenControls'
import { mousetrapHelper } from '../lib/mousetrapHelper'
import { ShowStyleBases, ShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { PeripheralDevicesAPI, callPeripheralDeviceFunction } from '../lib/clientAPI'
import { RONotificationEvent, onRONotificationClick as rundownNotificationHandler, RundownNotifier, reloadRundownClick } from './RundownView/RundownNotifier'
import { NotificationCenterPanel } from '../lib/notifications/NotificationCenterPanel'
import { NotificationCenter, NoticeLevel, Notification } from '../lib/notifications/notifications'
import { SupportPopUp } from './SupportPopUp'
import { PeripheralDevices, PeripheralDevice } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { doUserAction } from '../lib/userAction'
import { UserActionAPI } from '../../lib/api/userActions'
import { ClipTrimDialog } from './ClipTrimPanel/ClipTrimDialog'
import { NoteType } from '../../lib/api/notes'
import { PubSub } from '../../lib/api/pubsub'
import { RundownLayout, RundownLayouts, RundownLayoutType, RundownLayoutBase } from '../../lib/collections/RundownLayouts'
import { DeviceType as TSR_DeviceType } from 'timeline-state-resolver-types'
import { VirtualElement } from '../lib/VirtualElement'
import { SEGMENT_TIMELINE_ELEMENT_ID } from './SegmentTimeline/SegmentTimeline'
import { NoraPreviewRenderer } from './SegmentTimeline/Renderers/NoraPreviewRenderer'
import { Settings } from '../../lib/Settings'
import { PointerLockCursor } from '../lib/PointerLockCursor'
import { RegisteredHotkeys, registerHotkey, HotkeyAssignmentType } from '../lib/hotkeyRegistry'

export const MAGIC_TIME_SCALE_FACTOR = 0.03

type WrappedShelf = ShelfBase & { getWrappedInstance (): ShelfBase }

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
		document.body.addEventListener('focusin', this.checkFocus)
		document.body.addEventListener('focus', this.checkFocus)
		document.body.addEventListener('mousedown', this.checkFocus)
	}

	componentWillUnmount () {
		Meteor.clearInterval(this.keyboardFocusInterval)
		document.body.removeEventListener('focusin', this.checkFocus)
		document.body.removeEventListener('focus', this.checkFocus)
		document.body.removeEventListener('mousedown', this.checkFocus)
	}

	checkFocus = () => {
		const focusNow = document.hasFocus()
		if (this.state.inFocus !== focusNow) {
			this.setState({
				inFocus: focusNow
			})

			if (focusNow === false) {
				window.dispatchEvent(new Event('blur'))
			}
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
	inActiveRundownView?: boolean
	studioMode: boolean
	oneMinuteBeforeAction: (e: Event) => void
}

interface ITimingWarningState {
	plannedStartCloseShown?: boolean
	plannedStartCloseShow?: boolean
}

const WarningDisplay = translate()(timer(5000)(
	class extends React.Component<Translated<ITimingWarningProps>, ITimingWarningState> {
		private readonly REHEARSAL_MARGIN = 1 * 60 * 1000

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
				!this.props.inActiveRundownView && !this.state.plannedStartCloseShown) {

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
	RUNDOWN_TAKE = 'enter',
	RUNDOWN_HOLD = 'h',
	RUNDOWN_UNDO_HOLD = 'shift+h',
	RUNDOWN_ACTIVATE = '§',
	RUNDOWN_ACTIVATE2 = '\\',
	RUNDOWN_ACTIVATE3 = '|',
	RUNDOWN_ACTIVATE_REHEARSAL = 'mod+§',
	RUNDOWN_DEACTIVATE = 'mod+shift+§',
	RUNDOWN_GO_TO_LIVE = 'shift+home',
	RUNDOWN_REWIND_SEGMENTS = 'mod+home',
	RUNDOWN_RESET_RUNDOWN = 'shift+escape',
	RUNDOWN_TOGGLE_SHELF = 'tab',
	ADLIB_QUEUE_MODIFIER = 'shift',
	RUNDOWN_NEXT_FORWARD = 'shift+right',
	RUNDOWN_NEXT_DOWN = 'shift+down',
	RUNDOWN_NEXT_BACK = 'shift+left',
	RUNDOWN_NEXT_UP = 'shift+up',
	RUNDOWN_NEXT_FORWARD2 = 'shift+ArrowRight',
	RUNDOWN_NEXT_DOWN2 = 'shift+ArrowDown',
	RUNDOWN_NEXT_BACK2 = 'shift+ArrowLeft',
	RUNDOWN_NEXT_UP2 = 'shift+ArrowUp',
	// RUNDOWN_DISABLE_NEXT_ELEMENT = 'g',
	// RUNDOWN_UNDO_DISABLE_NEXT_ELEMENT = 'shift+g',
	RUNDOWN_LOG_ERROR	= 'shift+backspace',
	SHOW_CURRENT_SEGMENT_FULL_NONLATCH = ''
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
					(this.props.rundown.expectedStart ?
						<span className='timing-clock countdown playback-started left'>
							<span className='timing-clock-label left hide-overflow rundown-name' title={this.props.rundown.name}>{this.props.rundown.name}</span>
							{RundownUtils.formatDiffToTimecode(this.props.rundown.startedPlayback - this.props.rundown.expectedStart, true, false, true, true, true)}
						</span> :
						<span className='timing-clock countdown playback-started left'>
							<span className='timing-clock-label left hide-overflow rundown-name' title={this.props.rundown.name}>{this.props.rundown.name}</span>
						</span>)
					:
					(this.props.rundown.expectedStart ?
						<span className={ClassNames('timing-clock countdown plan-start left', {
							'heavy': getCurrentTime() > this.props.rundown.expectedStart
						})}>
							<span className='timing-clock-label left hide-overflow rundown-name' title={this.props.rundown.name}>{this.props.rundown.name}</span>
							{RundownUtils.formatDiffToTimecode(getCurrentTime() - this.props.rundown.expectedStart, true, false, true, true, true)}
						</span>
						:
						<span className={ClassNames('timing-clock countdown plan-start left')}>
							<span className='timing-clock-label left hide-overflow rundown-name' title={this.props.rundown.name}>{this.props.rundown.name}</span>
						</span>) || undefined
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
	up?: (e: any) => void
	down?: (e: any) => void
}

interface IRundownHeaderProps {
	rundown: Rundown,
	studio: Studio,
	onActivate?: (isRehearsal: boolean) => void,
	onRegisterHotkeys?: (hotkeys: Array<HotkeyDefinition>) => void
	studioMode: boolean
	inActiveRundownView?: boolean
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
					key: RundownViewKbdShortcuts.RUNDOWN_HOLD,
					up: this.keyHold,
					label: t('Hold')
				},{
					key: RundownViewKbdShortcuts.RUNDOWN_UNDO_HOLD,
					up: this.keyHoldUndo,
					label: t('Undo Hold')
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
					label: t('Reset Rundown'),
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
				},{
					key: RundownViewKbdShortcuts.RUNDOWN_NEXT_FORWARD2,
					up: this.keyMoveNextForward,
					label: t('Move Next forwards'),
					global: true
				},
				{
					key: RundownViewKbdShortcuts.RUNDOWN_NEXT_DOWN2,
					up: this.keyMoveNextDown,
					label: t('Move Next to the following segment'),
					global: true
				},
				{
					key: RundownViewKbdShortcuts.RUNDOWN_NEXT_UP2,
					up: this.keyMoveNextUp,
					label: t('Move Next to the previous segment'),
					global: true
				},
				{
					key: RundownViewKbdShortcuts.RUNDOWN_NEXT_BACK2,
					up: this.keyMoveNextBack,
					label: t('Move Next backwards'),
					global: true
				},
				// {
				// 	key: RundownViewKbdShortcuts.RUNDOWN_DISABLE_NEXT_ELEMENT,
				// 	up: this.keyDisableNextPiece,
				// 	label: t('Disable the next element'),
				// },
				// {
				// 	key: RundownViewKbdShortcuts.RUNDOWN_UNDO_DISABLE_NEXT_ELEMENT,
				// 	up: this.keyDisableNextPieceUndo,
				// 	label: t('Undo Disable the next element'),
				// },
				{
					key: RundownViewKbdShortcuts.RUNDOWN_LOG_ERROR,
					up: this.keyLogError,
					label: t('Log Error'),
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
		if (!isModalShowing()) this.take(e)
	}
	keyHold = (e: ExtendedKeyboardEvent) => {
		this.hold(e)
	}
	keyHoldUndo = (e: ExtendedKeyboardEvent) => {
		this.holdUndo(e)
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
		const { t } = this.props

		if (this.props.studioMode) {
			doUserAction(t, e, UserActionAPI.methods.disableNextPiece, [this.props.rundown._id, true])
		}
	}

	take = (e: any) => {
		const { t } = this.props
		if (this.props.studioMode) {
			doUserAction(t, e, UserActionAPI.methods.take, [this.props.rundown._id])
		}
	}

	moveNext = (e: any, horizonalDelta: number, verticalDelta: number) => {
		const { t } = this.props
		if (this.props.studioMode) {
			if (this.props.rundown.active) {
				doUserAction(t, e, UserActionAPI.methods.moveNext, [this.props.rundown._id, horizonalDelta, verticalDelta], (err, response) => {
					if (!err && response) {
						const partId = response.result
						if (partId) scrollToPart(partId).catch(() => console.error)
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
		const { t } = this.props
		if (this.props.studioMode && this.props.rundown.active) {
			doUserAction(t, e, UserActionAPI.methods.activateHold, [this.props.rundown._id, false])
		}
	}

	holdUndo = (e: any) => {
		const { t } = this.props
		if (this.props.studioMode && this.props.rundown.active && this.props.rundown.holdState === RundownHoldState.PENDING) {
			doUserAction(t, e, UserActionAPI.methods.activateHold, [this.props.rundown._id, true])
		}
	}

	rundownShouldHaveStarted () {
		return getCurrentTime() > (this.props.rundown.expectedStart || 0)
	}
	rundownShouldHaveEnded () {
		return getCurrentTime() > (this.props.rundown.expectedStart || 0) + (this.props.rundown.expectedDuration || 0)
	}

	handleAnotherRundownActive = (
		rundownId: string,
		rehersal: boolean,
		err: ClientAPI.ClientResponseError,
		clb?: Function
	) => {
		const { t } = this.props

		function handleResult (err, response) {
			if (!err) {
				if (typeof clb === 'function') clb(response)
			} else {
				console.error(err)
				doModalDialog({
					title: t('Failed to activate'),
					message: t('Something went wrong, please contact the system administrator if the problem persists.'),
					acceptOnly: true,
					warning: true,
					yes: t('OK'),
					onAccept: (le: any) => { console.log() }
				})
			}
		}

		const otherRundowns = err.details as Rundown[]
		doModalDialog({
			title: t('Another Rundown is Already Active!'),
			message: t('The rundown "{{rundownName}}" will need to be deactivated in order to activate this one.\n\nAre you sure you want to activate this one anyway?', {
				rundownName: otherRundowns.map(i => i.name).join(', ')
			}),
			yes: t('Activate Anyway'),
			no: t('Cancel'),
			actions: [
				{
					label: t('Activate Anyway (GO ON AIR)'),
					classNames: 'btn-primary',
					on: (e) => {
						doUserAction(t, e, UserActionAPI.methods.forceResetAndActivate, [rundownId, false], handleResult)
					}
				}
			],
			warning: true,
			onAccept: (e) => {
				doUserAction(t, e, UserActionAPI.methods.forceResetAndActivate, [rundownId, rehersal], handleResult)
			}
		})
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
			const onSuccess = () => {
				this.deferFlushAndRewindSegments()
				if (typeof this.props.onActivate === 'function') this.props.onActivate(false)
			}
			const doActivate = (le: any) => {
				doUserAction(t, le, UserActionAPI.methods.activate, [this.props.rundown._id, false], (err, response) => {
					if (!err) {
						if (typeof this.props.onActivate === 'function') this.props.onActivate(false)
					} else if (ClientAPI.isClientResponseError(err)) {
						if (err.error === 409) {
							this.handleAnotherRundownActive(this.props.rundown._id, false, err, () => {
								if (typeof this.props.onActivate === 'function') this.props.onActivate(false)
							})
							return false
						}
					}
				})
			}
			if (!this.rundownShouldHaveStarted()) {
				// The broadcast hasn't started yet
				doModalDialog({
					title: this.props.rundown.name,
					message: t('Do you want to activate this Rundown?'),
					onAccept: (le: any) => {
						this.rewindSegments()
						doUserAction(t, e, UserActionAPI.methods.resetAndActivate, [this.props.rundown._id], (err, response) => {
							if (!err) {
								onSuccess()
							} else if (ClientAPI.isClientResponseError(err)) {
								if (err.error === 409) {
									this.handleAnotherRundownActive(this.props.rundown._id, false, err, onSuccess)
									return false
								}
							}
						})
					}
				})
			} else if (!this.rundownShouldHaveEnded()) {
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
			const onSuccess = () => {
				if (typeof this.props.onActivate === 'function') this.props.onActivate(false)
			}
			let doActivateRehersal = (le: any) => {
				doUserAction(t, le, UserActionAPI.methods.activate, [this.props.rundown._id, true], (err, response) => {
					if (!err) {
						onSuccess()
					} else if (ClientAPI.isClientResponseError(err)) {
						if (err.error === 409) {
							this.handleAnotherRundownActive(this.props.rundown._id, true, err, onSuccess)
							return false
						}
					}
				})
			}
			if (!this.rundownShouldHaveStarted()) {
				// The broadcast hasn't started yet
				if (!this.props.rundown.active) {
					// inactive, do the full preparation:
					doUserAction(t, e, UserActionAPI.methods.prepareForBroadcast, [this.props.rundown._id], (err, response) => {
						if (!err) {
							onSuccess()
						} else if (ClientAPI.isClientResponseError(err)) {
							if (err.error === 409) {
								this.handleAnotherRundownActive(this.props.rundown._id, true, err, onSuccess)
								return false
							}
						}
					})
				} else if (!this.props.rundown.rehearsal) {
					// Active, and not in rehearsal
					doModalDialog({
						title: this.props.rundown.name,
						message: t('Are you sure you want to activate Rehearsal Mode?'),
						onAccept: (e) => {
							doActivateRehersal(e)
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
						onAccept: (e) => {
							doActivateRehersal(e)
						}
					})
				} else {
					// The broadcast has ended
					doActivateRehersal(e)
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
						warning: true,
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
		// if ((this.props.rundown.active && !this.props.rundown.rehearsal)) {
		// 	// The rundown is active and not in rehersal
		// 	doModalDialog({
		// 		title: this.props.rundown.name,
		// 		message: t('The rundown can not be reset while it is active'),
		// 		onAccept: () => {
		// 			// nothing
		// 		},
		// 		acceptOnly: true,
		// 		yes: 'OK'
		// 	})
		// } else {
		doReset()
		// }
	}

	reloadRundown = (e: any, changeRehearsal?: boolean) => {
		const { t } = this.props
		if (this.props.studioMode) {
			doUserAction(t, e, UserActionAPI.methods.reloadData, [this.props.rundown._id, changeRehearsal], (err, response) => {
				if (!err && response) {
					if (!handleRundownReloadResponse(t, this.props.rundown, response.result)) {
						if (this.props.rundown && this.props.rundown.nextPartId) {
							scrollToPart(this.props.rundown.nextPartId).catch(() => console.error)
						}
					}
				}
			})
		}
	}

	takeRundownSnapshot = (e) => {
		const { t } = this.props
		if (this.props.studioMode) {
			doUserAction(t, e, UserActionAPI.methods.storeRundownSnapshot, [this.props.rundown._id, 'Taken by user'], undefined,
				t('A snapshot of the current Running\xa0Order has been created for troubleshooting.'))
		}
	}

	resetAndActivateRundown = (e: any) => {
		// Called from the ModalDialog, 1 minute before broadcast starts
		if (this.props.studioMode) {
			const { t } = this.props
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
				this.rewindSegments()
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
									// !(this.props.rundown.active && !this.props.rundown.rehearsal) ?
										<MenuItem onClick={(e) => this.resetRundown(e)}>
											{t('Reset Rundown')}
										</MenuItem>
										// </MenuItem> :
										// null
								}
								<MenuItem onClick={(e) => this.reloadRundown(e)}>
									{t('Reload iNews Data')}
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
						inActiveRundownView={this.props.inActiveRundownView}
						rundown={this.props.rundown}
						oneMinuteBeforeAction={this.resetAndActivateRundown}
					/>
					<div className='row first-row super-dark'>
						<div className='flex-col left horizontal-align-left'>
							<div className='badge mod'>
								<Tooltip overlay={t('Add ?studio=1 to the URL to enter studio mode')} visible={getHelpMode() && !getAllowStudio()} placement='bottom'>
									<div className='media-elem mrs sofie-logo' />
								</Tooltip>
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
						{this.props.studio && <RundownSystemStatus studio={this.props.studio} rundown={this.props.rundown} />}
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
	inActiveRundownView?: boolean
	onlyShelf?: boolean
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
	isInspectorShelfExpanded: boolean
	isClipTrimmerOpen: boolean
	selectedPiece: PieceUi | undefined
	rundownLayout: RundownLayout | undefined
}

export enum RundownViewEvents {
	'rewindsegments'	=	'sofie:rundownRewindSegments',
	'goToLiveSegment'	=	'sofie:goToLiveSegment',
	'goToTop'			=	'sofie:goToTop',
	'segmentZoomOn'		=	'sofie:segmentZoomOn',
	'segmentZoomOff'	=	'sofie:segmentZoomOff'
}

interface ITrackedProps {
	rundownId: string
	rundown?: Rundown
	segments: Array<Segment>
	studio?: Studio
	showStyleBase?: ShowStyleBase
	rundownLayouts?: Array<RundownLayoutBase>
	casparCGPlayoutDevices?: PeripheralDevice[]
	rundownLayoutId?: string
}
export const RundownView = translateWithTracker<IProps, IState, ITrackedProps>((props: IProps, state) => {

	let rundownId
	if (props.match && props.match.params.rundownId) {
		rundownId = decodeURIComponent(props.match.params.rundownId)
	} else if (props.rundownId) {
		rundownId = props.rundownId
	}

	let rundown = Rundowns.findOne({ _id: rundownId })
	let studio = rundown && Studios.findOne({ _id: rundown.studioId })

	const params = queryStringParse(location.search)

	// let rundownDurations = calculateDurations(rundown, parts)
	return {
		rundownId: rundownId,
		rundown: rundown,
		segments: rundown ? Segments.find({
			rundownId: rundown._id,
			isHidden: {
				$ne: true
			}
		}, {
			sort: {
				'_rank': 1
			}
		}).fetch() : [],
		studio: studio,
		showStyleBase: rundown && ShowStyleBases.findOne(rundown.showStyleBaseId),
		rundownLayouts: rundown && RundownLayouts.find({
			showStyleBaseId: rundown.showStyleBaseId }).fetch(),
		casparCGPlayoutDevices: (studio && PeripheralDevices.find({
			parentDeviceId: {
				$in: PeripheralDevices.find({
					studioId: studio._id
				}).fetch().map(i => i._id)
			},
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
			subType: TSR_DeviceType.CASPARCG
		}).fetch()) || undefined,
		rundownLayoutId: String(params['layout'])
	}
})(class RundownView extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
	private readonly LIVELINE_HISTORY_SIZE = 100

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
	private _inspectorShelf: WrappedShelf | null
	private _segmentZoomOn: boolean = false

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

		if (RundownViewKbdShortcuts.SHOW_CURRENT_SEGMENT_FULL_NONLATCH) {
			this.bindKeys.push({
				key: RundownViewKbdShortcuts.SHOW_CURRENT_SEGMENT_FULL_NONLATCH,
				down: this.onShowCurrentSegmentFullOn,
				up: this.onShowCurrentSegmentFullOff,
				label: t('Show entire current segment'),
				global: false
			})
		}

		this.usedArgumentKeys = []

		this.state = {
			timeScale: MAGIC_TIME_SCALE_FACTOR * Settings.defaultTimeScale,
			studioMode: getAllowStudio(),
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
			isInspectorShelfExpanded: false,
			isClipTrimmerOpen: false,
			selectedPiece: undefined,
			rundownLayout: undefined
		}
	}

	static getDerivedStateFromProps (props: Translated<IProps & ITrackedProps>, state: IState) {
		let selectedLayout: RundownLayoutBase | undefined = undefined

		if (props.rundownLayouts) {
			// first try to use the one selected by the user
			if (props.rundownLayoutId) {
				selectedLayout = props.rundownLayouts.find((i) => i._id === props.rundownLayoutId)
			}

			// if couldn't find based on id, try matching part of the name
			if (props.rundownLayoutId && !selectedLayout) {
				selectedLayout = props.rundownLayouts.find((i) => i.name.indexOf(props.rundownLayoutId!) >= 0)
			}

			// if not, try the first RUNDOWN_LAYOUT available
			if (!selectedLayout) {
				selectedLayout = props.rundownLayouts.find((i) => i.type === RundownLayoutType.RUNDOWN_LAYOUT)
			}

			// if still not found, use the first one
			if (!selectedLayout) {
				selectedLayout = props.rundownLayouts[0]
			}
		}

		return {
			rundownLayout: selectedLayout
		}
	}

	componentDidMount () {
		let rundownId = this.props.rundownId

		this.subscribe(PubSub.rundowns, {
			_id: rundownId
		})
		this.subscribe(PubSub.segments, {
			rundownId: rundownId
		})
		this.subscribe(PubSub.parts, {
			rundownId: rundownId
		})
		this.subscribe(PubSub.pieces, {
			rundownId: rundownId
		})
		this.subscribe(PubSub.adLibPieces, {
			rundownId: rundownId
		})
		this.autorun(() => {
			let rundown = Rundowns.findOne(rundownId)
			if (rundown) {
				this.subscribe(PubSub.studios, {
					_id: rundown.studioId
				})
				this.subscribe(PubSub.showStyleBases, {
					_id: rundown.showStyleBaseId
				})
				this.subscribe(PubSub.rundownLayouts, {
					showStyleBaseId: rundown.showStyleBaseId
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

		document.body.classList.add('dark', 'vertical-overflow-only')
		// window.addEventListener('scroll', this.onWindowScroll)

		let preventDefault = (e) => {
			e.preventDefault()
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
			const partId = this.props.rundown.nextPartId
			setTimeout(() => {
				scrollToPart(partId).catch(() => console.error)
			}, Settings.defaultToCollapsedSegments ? 750 : 0)
		} else if (
			// after take
			(this.props.rundown &&
			prevProps.rundown && this.props.rundown.currentPartId !== prevProps.rundown.currentPartId &&
			this.props.rundown.currentPartId && this.state.followLiveSegments)
		) {
			const partId = this.props.rundown.currentPartId
			setTimeout(() => {
				scrollToPart(partId, true).catch(() => console.error)
			}, Settings.defaultToCollapsedSegments ? 750 : 0)
		} else if (
			// initial Rundown open
			(this.props.rundown && this.props.rundown.currentPartId &&
			this.state.subsReady && !prevState.subsReady)
		) {
			// allow for some time for the Rundown to render
			maintainFocusOnPart(this.props.rundown.currentPartId, 7000, true, true)
		}

		if (typeof this.props.rundown !== typeof this.props.rundown ||
			(this.props.rundown || { _id: '' })._id !== (prevProps.rundown || { _id: '' })._id ||
			(this.props.rundown || { active: false }).active !== (prevProps.rundown || { active: false }).active ||
			this.state.studioMode !== prevState.studioMode) {
			if (this.props.rundown && this.props.rundown.active && this.state.studioMode && !getAllowDeveloper()) {
				window.addEventListener('beforeunload', this.onBeforeUnload)
			} else {
				window.removeEventListener('beforeunload', this.onBeforeUnload)
			}
		}

		if (typeof this.props.showStyleBase !== typeof prevProps.showStyleBase ||
			this.props.showStyleBase && this.props.showStyleBase.runtimeArguments) {
			this.refreshHotkeys()
		}
	}

	refreshHotkeys = () => {
		const { t } = this.props
		let preventDefault = (e) => {
			e.preventDefault()
		}
		const noOp = (e) => {
			preventDefault(e)
		}

		const HOTKEY_GROUP = 'RuntimeArguments'

		this.usedArgumentKeys.forEach((k) => {
			if (k.up) {
				mousetrapHelper.unbind(k.key, HOTKEY_GROUP, 'keyup')
				mousetrapHelper.unbind(k.key, HOTKEY_GROUP, 'keydown')
			}
			if (k.down) {
				mousetrapHelper.unbind(k.key, HOTKEY_GROUP, 'keydown')
			}
		})

		this.usedArgumentKeys = []

		RegisteredHotkeys.remove({
			tag: HOTKEY_GROUP
		})

		if (this.props.showStyleBase) {
			_.each(this.props.showStyleBase.runtimeArguments, (i) => {
				const combos = i.hotkeys.split(',')
				const handler = (e: KeyboardEvent) => {
					if (this.props.rundown && this.props.rundown.active && this.props.rundown.nextPartId) {
						doUserAction(t, e, UserActionAPI.methods.togglePartArgument, [
							this.props.rundown._id, this.props.rundown.nextPartId, i.property, i.value
						])
					}
				}
				_.each(combos, (combo: string) => {
					mousetrapHelper.bind(combo, handler, 'keyup', HOTKEY_GROUP)
					mousetrapHelper.bind(combo, noOp, 'keydown', HOTKEY_GROUP)
					this.usedArgumentKeys.push({
						up: handler,
						key: combo,
						label: i.label || ''
					})

					registerHotkey(
						combo,
						i.label || '',
						HotkeyAssignmentType.RUNTIME_ARGUMENT,
						undefined,
						false,
						handler,
						undefined,
						HOTKEY_GROUP
					)
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
		document.body.classList.remove('dark', 'vertical-overflow-only')
		// window.removeEventListener('scroll', this.onWindowScroll)
		window.removeEventListener('beforeunload', this.onBeforeUnload)

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
		const { t } = this.props

		e.preventDefault()
		e.returnValue = t('This rundown is now active. Are you sure you want to exit this screen?')

		return t('This rundown is now active. Are you sure you want to exit this screen?')
	}

	onRewindSegments = () => {
		window.dispatchEvent(new Event(RundownViewEvents.rewindsegments))
	}

	onShowCurrentSegmentFullOn = () => {
		if (this._segmentZoomOn === false) {
			console.log(`Dispatching event: ${RundownViewEvents.segmentZoomOn}`)
			window.dispatchEvent(new Event(RundownViewEvents.segmentZoomOn))
			this._segmentZoomOn = true
		}
	}

	onShowCurrentSegmentFullOff = () => {
		console.log(`Dispatching event: ${RundownViewEvents.segmentZoomOff}`)
		window.dispatchEvent(new Event(RundownViewEvents.segmentZoomOff))
		this._segmentZoomOn = false
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

	// onWindowScroll = (e: Event) => {
	// 	console.log('Scroll handler')
	// 	const isAutoScrolling = document.body.classList.contains('auto-scrolling')
	// 	if (this.state.followLiveSegments && !isAutoScrolling && this.props.rundown && this.props.rundown.active) {
	// 		this.setState({
	// 			followLiveSegments: false
	// 		})
	// 	}
	// }

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
		scrollToPosition(0).catch(console.error)

		window.requestIdleCallback(() => {
			this.setState({
				followLiveSegments: true
			})
		}, { timeout: 1000 })
	}
	onGoToLiveSegment = () => {
		if (this.props.rundown && this.props.rundown.active && !this.props.rundown.currentPartId &&
			this.props.rundown.nextPartId) {
			this.setState({
				followLiveSegments: true
			})
			scrollToPart(this.props.rundown.nextPartId, true).then(() => {
				// allow for the scroll to finish
			}).catch((e) => {
				console.error(e)
			})
			setTimeout(() => {
				this.setState({
					followLiveSegments: true
				})
				window.dispatchEvent(new Event(RundownViewEvents.rewindsegments))
			}, 2000)
		} else if (this.props.rundown && this.props.rundown.active && this.props.rundown.currentPartId) {
			this.setState({
				followLiveSegments: true
			})
			scrollToPart(this.props.rundown.currentPartId, true).then(() => {
				// allow for the scroll to finish
			}).catch((e) => {
				console.error(e)
			})
			setTimeout(() => {
				// console.log("followLiveSegments: true")
				this.setState({
					followLiveSegments: true
				})
				window.dispatchEvent(new Event(RundownViewEvents.rewindsegments))
			}, 2000)
		} else {
			this.setState({
				followLiveSegments: true
			})
		}
	}

	onActivate = (isRehearsal: boolean) => {
		this.onGoToLiveSegment()
	}

	onContextMenu = (contextMenuContext: any) => {
		this.setState({
			contextMenuContext
		})
	}

	onSetNext = (part: Part, e: any, offset?: number, take?: boolean) => {
		const { t } = this.props
		if (this.state.studioMode && part && part._id && this.props.rundown) {
			doUserAction(t, e, UserActionAPI.methods.setNext, [this.props.rundown._id, part._id, offset], (err, res) => {
				this.setState({
					manualSetAsNext: true
				})
				if (!err && take && this.props.rundown) {
					doUserAction(t, e, UserActionAPI.methods.take, [this.props.rundown._id])
				}
			})
		}
	}
	onSetNextSegment = (segmentId: string | null, e: any) => {
		const { t } = this.props
		if (this.state.studioMode && (segmentId || segmentId === null)  && this.props.rundown) {
			doUserAction(t, e, UserActionAPI.methods.setNextSegment, [this.props.rundown._id, segmentId],  (err, res) => {
				this.setState({
					manualSetAsNext: true
				})
			})
		}
	}

	onResyncSegment = (segmentId: string, e: any) => {
		const { t } = this.props
		if (this.state.studioMode && this.props.rundown) {
			doUserAction(t, undefined, UserActionAPI.methods.resyncSegment, [this.props.rundown._id, segmentId], (err, response) => {

			})
		}
	}

	onPieceDoubleClick = (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => {
		const { t } = this.props
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
				scrollToSegment(segmentId).catch(console.error)
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

	onToggleSupportPanel = (e: React.MouseEvent<HTMLButtonElement>) => {
		this.setState({
			isSupportPanelOpen: !this.state.isSupportPanelOpen
		})
	}

	renderSegments () {
		if (this.props.segments) {
			return this.props.segments.map((segment, index, array) => {
				if (
					this.props.studio &&
					this.props.rundown &&
					this.props.showStyleBase
				) {
					return <ErrorBoundary key={segment._id}>
							<VirtualElement
								id={SEGMENT_TIMELINE_ELEMENT_ID + segment._id}
								margin={'100% 0px 100% 0px'}
								initialShow={index < (window.innerHeight / 260)}
								placeholderHeight={260}
								placeholderClassName='placeholder-shimmer-element segment-timeline-placeholder'
								width='auto'>
								<SegmentTimelineContainer
									id={SEGMENT_TIMELINE_ELEMENT_ID + segment._id}
									studio={this.props.studio}
									showStyleBase={this.props.showStyleBase}
									followLiveSegments={this.state.followLiveSegments}
									segmentId={segment._id}
									rundown={this.props.rundown}
									liveLineHistorySize={this.LIVELINE_HISTORY_SIZE}
									timeScale={this.state.timeScale}
									onTimeScaleChange={this.onTimeScaleChange}
									onContextMenu={this.onContextMenu}
									onSegmentScroll={this.onSegmentScroll}
									isLastSegment={index === array.length - 1}
									onPieceClick={this.onSelectPiece}
									onPieceDoubleClick={this.onPieceDoubleClick}
									onHeaderNoteClick={(level) => this.onHeaderNoteClick(segment._id, level)}
								/>
							</VirtualElement>
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

		const HOTKEY_TAG = 'RundownView'

		RegisteredHotkeys.remove({
			tag: HOTKEY_TAG
		})

		function noop () { }

		this.state.usedHotkeys.forEach((hotkey) => {
			registerHotkey(
				hotkey.key,
				hotkey.label,
				HotkeyAssignmentType.SYSTEM,
				undefined,
				false,
				hotkey.up || hotkey.down || noop,
				undefined,
				HOTKEY_TAG
			)
		})
	}

	onContextMenuTop = (e: React.MouseEvent<HTMLDivElement>): boolean => {
		if (!getAllowDeveloper()) {
			e.preventDefault()
			e.stopPropagation()
		}
		return false
	}

	onToggleNotifications = (e: React.MouseEvent<HTMLButtonElement>) => {
		if (!this.state.isNotificationsCenterOpen === true) {
			NotificationCenter.highlightSource(undefined, NoticeLevel.CRITICAL)
		}

		NotificationCenter.isOpen = !this.state.isNotificationsCenterOpen

		this.setState({
			isNotificationsCenterOpen: !this.state.isNotificationsCenterOpen
		})
	}

	onToggleHotkeys = () => {
		if (!this.state.isInspectorShelfExpanded) {
			this.setState({
				isInspectorShelfExpanded: true
			})
			if (this._inspectorShelf) {
				this._inspectorShelf.getWrappedInstance().switchTab(ShelfTabs.SYSTEM_HOTKEYS)
			}
		} else {
			this.setState({
				isInspectorShelfExpanded: false
			})
		}
	}

	onRestartPlayout = (e: React.MouseEvent<HTMLButtonElement>) => {
		const { t } = this.props

		if (this.props.studio) {
			const attachedPlayoutGateways = PeripheralDevices.find({
				studioId: this.props.studio._id,
				connected: true,
				type: PeripheralDeviceAPI.DeviceType.PLAYOUT
			}).fetch()
			if (attachedPlayoutGateways.length === 0) {
				NotificationCenter.push(new Notification(undefined, NoticeLevel.CRITICAL, t('There are no Playout\xa0Gateways connected and attached to this studio. Please contact the system administrator to start the Playout Gateway.'), 'RundownView'))
				return
			}
			attachedPlayoutGateways.forEach((item) => {
				PeripheralDevicesAPI.restartDevice(item, e).then(() => {
					NotificationCenter.push(new Notification(undefined, NoticeLevel.NOTIFICATION, t('Playout\xa0Gateway "{{playoutDeviceName}}" is now restarting.', { playoutDeviceName: item.name }), 'RundownView'))
				}).catch(() => {
					NotificationCenter.push(new Notification(undefined, NoticeLevel.CRITICAL, t('Could not restart Playout\xa0Gateway "{{playoutDeviceName}}".', { playoutDeviceName: item.name }), 'RundownView'))
				})
			})
		}
	}

	onRestartCasparCG = (device: PeripheralDevice) => {
		const { t } = this.props

		doModalDialog({
			title: t('Restart CasparCG Server'),
			message: t('Do you want to restart CasparCG Server "{{device}}"?', { device: device.name }),
			onAccept: (event: any) => {

				callPeripheralDeviceFunction(event, device._id, 'restartCasparCG', (err, result) => {
					if (err) {
						// console.error(err)
						NotificationCenter.push(new Notification(undefined, NoticeLevel.WARNING, t('Failed to restart CasparCG on device: "{{deviceName}}": {{errorMessage}}', { deviceName: device.name, errorMessage: err + '' }), 'SystemStatus'))
					} else {
						// console.log(result)
						NotificationCenter.push(new Notification(undefined, NoticeLevel.NOTIFICATION, t('CasparCG on device "{{deviceName}}" restarting...', { deviceName: device.name }), 'SystemStatus'))
					}
				})
			},
		})
	}

	onTakeRundownSnapshot = (e: React.MouseEvent<HTMLButtonElement>) => {
		const { t } = this.props
		if (this.props.rundown) {
			doUserAction(t, e, UserActionAPI.methods.storeRundownSnapshot, [this.props.rundown._id, 'User requested log at' + getCurrentTime()], undefined,
				t('A snapshot of the current Running\xa0Order has been created for troubleshooting.'))
		}
	}

	onShelfChangeExpanded = (value: boolean) => {
		this.setState({
			isInspectorShelfExpanded: value
		})
	}

	setInspectorShelf = (isp: WrappedShelf | null) => {
		this._inspectorShelf = isp
	}

	onTake = (e: any) => {
		const { t } = this.props
		if (this.state.studioMode && this.props.rundown) {
			doUserAction(t, e, UserActionAPI.methods.take, [this.props.rundown._id])
		}
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
				this.props.studio &&
				this.props.showStyleBase &&
				!this.props.onlyShelf
			) {
				return (
					<RundownTimingProvider
						rundown={this.props.rundown}
						defaultDuration={Settings.defaultDisplayDuration}>
						<div className={ClassNames('rundown-view', {
							'notification-center-open': this.state.isNotificationsCenterOpen,
							'rundown-view--studio-mode': this.state.studioMode
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
									onToggleSupportPanel={this.onToggleSupportPanel}
									isStudioMode={this.state.studioMode}
									onTake={this.onTake} />
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
											{this.state.studioMode &&
												<button className='btn btn-primary' onClick={this.onRestartPlayout}>{t('Restart Playout')}</button>
											}
											{this.state.studioMode && this.props.casparCGPlayoutDevices &&
												this.props.casparCGPlayoutDevices.map(i => <button className='btn btn-primary' onClick={() => this.onRestartCasparCG(i)} key={i._id}>{t('Restart {{device}}', { device: i.name })}</button>)
											}
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
									studio={this.props.studio}
									onActivate={this.onActivate}
									studioMode={this.state.studioMode}
									onRegisterHotkeys={this.onRegisterHotkeys}
									inActiveRundownView={this.props.inActiveRundownView} />
							</ErrorBoundary>
							<ErrorBoundary>
								<NoraPreviewRenderer />
							</ErrorBoundary>
							<ErrorBoundary>
								<SegmentContextMenu
									contextMenuContext={this.state.contextMenuContext}
									rundown={this.props.rundown}
									onSetNext={this.onSetNext}
									onSetNextSegment={this.onSetNextSegment}
									onResyncSegment={this.onResyncSegment}
									studioMode={this.state.studioMode} />
							</ErrorBoundary>
							<ErrorBoundary>
								{this.state.isClipTrimmerOpen && this.state.selectedPiece && this.props.studio &&
									<ClipTrimDialog
										studio={this.props.studio}
										rundownId={this.props.rundownId}
										selectedPiece={this.state.selectedPiece}
										onClose={() => this.setState({ isClipTrimmerOpen: false })}
										/>
								}
							</ErrorBoundary>
							{this.renderSegmentsList()}
							<ErrorBoundary>
								<PointerLockCursor />
							</ErrorBoundary>
							<ErrorBoundary>
								{ this.props.segments && this.props.segments.length > 0 && <AfterBroadcastForm
									rundown={this.props.rundown}
								/> }
							</ErrorBoundary>
							<ErrorBoundary>
								<PointerLockCursor />
							</ErrorBoundary>
							<ErrorBoundary>
								<Shelf
									ref={this.setInspectorShelf}
									isExpanded={this.state.isInspectorShelfExpanded}
									onChangeExpanded={this.onShelfChangeExpanded}
									segments={this.props.segments}
									hotkeys={this.state.usedHotkeys}
									rundown={this.props.rundown}
									showStyleBase={this.props.showStyleBase}
									studioMode={this.state.studioMode}
									onChangeBottomMargin={this.onChangeBottomMargin}
									onRegisterHotkeys={this.onRegisterHotkeys}
									rundownLayout={this.state.rundownLayout} />
							</ErrorBoundary>
							<ErrorBoundary>
								{this.props.rundown && this.props.studio && this.props.showStyleBase &&
									<RundownNotifier rundownId={this.props.rundown._id} studio={this.props.studio} showStyleBase={this.props.showStyleBase} />
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
			} else if (
				this.props.rundown &&
				this.props.studio &&
				this.props.showStyleBase &&
				this.props.onlyShelf
			) {
				return <ErrorBoundary>
					<Shelf
						ref={this.setInspectorShelf}
						isExpanded={this.state.isInspectorShelfExpanded}
						onChangeExpanded={this.onShelfChangeExpanded}
						segments={this.props.segments}
						hotkeys={this.state.usedHotkeys}
						rundown={this.props.rundown}
						showStyleBase={this.props.showStyleBase}
						studioMode={this.state.studioMode}
						onChangeBottomMargin={this.onChangeBottomMargin}
						onRegisterHotkeys={this.onRegisterHotkeys}
						rundownLayout={this.state.rundownLayout}
						fullViewport={true} />
				</ErrorBoundary>
			} else {
				return (
					<div className='rundown-view rundown-view--unpublished'>
						<div className='rundown-view__label'>
							<p>
								{
									!this.props.rundown ?
										t('This rundown has been unpublished from Sofie.') :
									!this.props.studio ?
										t('Error: The studio of this Rundown was not found.') :
									!this.props.showStyleBase ?
										t('Error: The ShowStyle of this Rundown was not found.') :
									t('Unknown error')
								}
							</p>
							<p>
								<Route render={({ history }) => (
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

export function handleRundownReloadResponse (t: i18next.TranslationFunction<any, object, string>, rundown: Rundown, result: UserActionAPI.TriggerReloadDataResponse): boolean {
	let hasDoneSomething = false
	if (result === UserActionAPI.TriggerReloadDataResponse.MISSING) {
		hasDoneSomething = true
		const notification = NotificationCenter.push(new Notification(undefined, NoticeLevel.CRITICAL,
			t('Rundown {{rundownName}} is missing, what do you want to do?', { rundownName: rundown.name }),
			'userAction',
			undefined,
			true, [
				// actions:
				{
					label: t('Mark rundown as unsynced'),
					type: 'default',
					action: () => {
						doUserAction(t, 'Missing rundown action', UserActionAPI.methods.unsyncRundown, [ rundown._id ], (err) => {
							if (!err) {
								notification.stop()
							}
						})
					}
				},
				{
					label: t('Remove rundown'),
					type: 'default',
					action: () => {
						doModalDialog({
							title: rundown.name,
							message: t('Do you really want to remove the rundown "{{rundownName}}"? This cannot be undone!', { rundownName: rundown.name }),
							onAccept: () => {
								// nothing
								doUserAction(t, 'Missing rundown action', UserActionAPI.methods.removeRundown, [ rundown._id], (err) => {
									if (!err) {
										notification.stop()
										window.location.assign(`/`)
									}
								})
							},
						})
					}
				}
			]
		))
	}
	return hasDoneSomething
}
