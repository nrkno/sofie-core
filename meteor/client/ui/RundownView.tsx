import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import { parse as queryStringParse } from 'query-string'
import * as VelocityReact from 'velocity-react'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { VTContent, TSR, NoteSeverity } from '@sofie-automation/blueprints-integration'
import { withTranslation, WithTranslation } from 'react-i18next'
import timer from 'react-timer-hoc'
import CoreIcon from '@nrk/core-icons/jsx'
import { Spinner } from '../lib/Spinner'
import ClassNames from 'classnames'
import * as _ from 'underscore'
import Escape from 'react-escape'
import * as i18next from 'i18next'
import Tooltip from 'rc-tooltip'
import { NavLink, Route, Prompt } from 'react-router-dom'
import {
	RundownPlaylist,
	RundownPlaylists,
	RundownPlaylistId,
	RundownPlaylistCollectionUtil,
} from '../../lib/collections/RundownPlaylists'
import { Rundown, Rundowns, RundownHoldState, RundownId } from '../../lib/collections/Rundowns'
import { DBSegment, Segment, SegmentId } from '../../lib/collections/Segments'
import { Studio, Studios, StudioRouteSet, DBStudio } from '../../lib/collections/Studios'
import { Part, PartId, Parts } from '../../lib/collections/Parts'

import { ContextMenu, MenuItem, ContextMenuTrigger } from '@jstarpl/react-contextmenu'

import { RundownTimingProvider } from './RundownView/RundownTiming/RundownTimingProvider'
import { withTiming, WithTiming } from './RundownView/RundownTiming/withTiming'
import { CurrentPartRemaining } from './RundownView/RundownTiming/CurrentPartRemaining'
import { AutoNextStatus } from './RundownView/RundownTiming/AutoNextStatus'
import { SegmentTimelineContainer, PieceUi, PartUi, SegmentUi } from './SegmentTimeline/SegmentTimelineContainer'
import { SegmentContextMenu } from './SegmentTimeline/SegmentContextMenu'
import { Shelf, ShelfTabs } from './Shelf/Shelf'
import { RundownSystemStatus } from './RundownView/RundownSystemStatus'

import { getCurrentTime, unprotectString, protectString } from '../../lib/lib'
import { RundownUtils } from '../lib/rundown'

import { ErrorBoundary } from '../lib/ErrorBoundary'
import { ModalDialog, doModalDialog, isModalShowing } from '../lib/ModalDialog'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { getAllowStudio, getAllowDeveloper, getHelpMode } from '../lib/localStorage'
import { ClientAPI } from '../../lib/api/client'
import {
	scrollToPosition,
	scrollToSegment,
	maintainFocusOnPartInstance,
	scrollToPartInstance,
	getHeaderHeight,
} from '../lib/viewPort'
import { AfterBroadcastForm } from './AfterBroadcastForm'
import { Tracker } from 'meteor/tracker'
import { RundownRightHandControls } from './RundownView/RundownRightHandControls'
import { ShowStyleBases, ShowStyleBase, ShowStyleBaseId, DBShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { PeripheralDevicesAPI, callPeripheralDeviceFunction } from '../lib/clientAPI'
import {
	RONotificationEvent,
	onRONotificationClick as rundownNotificationHandler,
	RundownNotifier,
	reloadRundownPlaylistClick,
} from './RundownView/RundownNotifier'
import { NotificationCenterPanel } from '../lib/notifications/NotificationCenterPanel'
import { NotificationCenter, NoticeLevel, Notification } from '../lib/notifications/notifications'
import { SupportPopUp } from './SupportPopUp'
import { KeyboardFocusIndicator } from '../lib/KeyboardFocusIndicator'
import { PeripheralDevices, PeripheralDevice, PeripheralDeviceType } from '../../lib/collections/PeripheralDevices'
import { doUserAction, UserAction } from '../lib/userAction'
import { ReloadRundownPlaylistResponse, TriggerReloadDataResponse } from '../../lib/api/userActions'
import { ClipTrimDialog } from './ClipTrimPanel/ClipTrimDialog'
import { PubSub } from '../../lib/api/pubsub'
import {
	RundownLayouts,
	RundownLayoutType,
	RundownLayoutBase,
	RundownLayoutId,
	RundownViewLayout,
	RundownLayoutShelfBase,
	RundownLayoutRundownHeader,
} from '../../lib/collections/RundownLayouts'
import { VirtualElement } from '../lib/VirtualElement'
import { SEGMENT_TIMELINE_ELEMENT_ID } from './SegmentTimeline/SegmentTimeline'
import { NoraPreviewRenderer } from './FloatingInspectors/NoraFloatingInspector'
import { Buckets, Bucket } from '../../lib/collections/Buckets'
import { contextMenuHoldToDisplayTime, isEventInInputField } from '../lib/lib'
import { OffsetPosition } from '../utils/positions'
import { Settings } from '../../lib/Settings'
import { MeteorCall } from '../../lib/api/methods'
import { PointerLockCursor } from '../lib/PointerLockCursor'
import { AdLibPieceUi } from './Shelf/AdLibPanel'
import { documentTitle } from '../lib/DocumentTitleProvider'
import { PartInstance } from '../../lib/collections/PartInstances'
import { RundownDividerHeader } from './RundownView/RundownDividerHeader'
import { PlaylistLoopingHeader } from './RundownView/PlaylistLoopingHeader'
import { CASPARCG_RESTART_TIME } from '../../lib/constants'
import { memoizedIsolatedAutorun } from '../lib/reactiveData/reactiveDataHelper'
import RundownViewEventBus, {
	ActivateRundownPlaylistEvent,
	IEventContext,
	RundownViewEvents,
} from './RundownView/RundownViewEventBus'
import StudioContext from './RundownView/StudioContext'
import { RundownLayoutsAPI } from '../../lib/api/rundownLayouts'
import { TriggersHandler } from '../lib/triggers/TriggersHandler'
import { SorensenContext } from '../lib/SorensenContext'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { BreakSegment } from './SegmentTimeline/BreakSegment'
import { PlaylistStartTiming } from './RundownView/RundownTiming/PlaylistStartTiming'
import { RundownName } from './RundownView/RundownTiming/RundownName'
import { TimeOfDay } from './RundownView/RundownTiming/TimeOfDay'
import { PlaylistEndTiming } from './RundownView/RundownTiming/PlaylistEndTiming'
import { NextBreakTiming } from './RundownView/RundownTiming/NextBreakTiming'
import { ShowStyleVariant, ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { BucketAdLibItem } from './Shelf/RundownViewBuckets'
import { IAdLibListItem } from './Shelf/AdLibListItem'
import { ShelfDashboardLayout } from './Shelf/ShelfDashboardLayout'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { SegmentStoryboardContainer } from './SegmentStoryboard/SegmentStoryboardContainer'
import { SegmentViewMode } from './SegmentContainer/SegmentViewModes'
import { UIStateStorage } from '../lib/UIStateStorage'

export const MAGIC_TIME_SCALE_FACTOR = 0.03

const REHEARSAL_MARGIN = 1 * 60 * 1000
const HIDE_NOTIFICATIONS_AFTER_MOUNT: number | undefined = 5000

const DEFAULT_SEGMENT_VIEW_MODE = SegmentViewMode.Timeline

interface ITimingWarningProps {
	playlist: RundownPlaylist
	inActiveRundownView?: boolean
	studioMode: boolean
	oneMinuteBeforeAction: (e: Event) => void
}

interface ITimingWarningState {
	plannedStartCloseShown?: boolean
	plannedStartCloseShow?: boolean
}
const WarningDisplay = withTranslation()(
	timer(5000)(
		class WarningDisplay extends React.Component<Translated<ITimingWarningProps>, ITimingWarningState> {
			constructor(props: Translated<ITimingWarningProps>) {
				super(props)

				this.state = {}
			}

			componentDidUpdate(prevProps: ITimingWarningProps) {
				if (
					(this.props.playlist.activationId && !prevProps.playlist.activationId && this.props.playlist.rehearsal) ||
					this.props.playlist.rehearsal !== prevProps.playlist.rehearsal
				) {
					this.setState({
						plannedStartCloseShown: false,
					})
				}

				const expectedStart = PlaylistTiming.getExpectedStart(this.props.playlist.timing)
				const expectedDuration = PlaylistTiming.getExpectedDuration(this.props.playlist.timing)

				if (
					this.props.playlist.activationId &&
					this.props.playlist.rehearsal &&
					expectedStart &&
					// the expectedStart is near
					getCurrentTime() + REHEARSAL_MARGIN > expectedStart &&
					// but it's not horribly in the past
					getCurrentTime() < expectedStart + (expectedDuration || 60 * 60 * 1000) &&
					!this.props.inActiveRundownView &&
					!this.state.plannedStartCloseShown
				) {
					this.setState({
						plannedStartCloseShow: true,
						plannedStartCloseShown: true,
					})
				}
			}

			discard = () => {
				this.setState({
					plannedStartCloseShow: false,
				})
			}

			oneMinuteBeforeAction = (e: any) => {
				this.setState({
					plannedStartCloseShow: false,
				})

				this.props.oneMinuteBeforeAction(e)
			}

			render() {
				const { t } = this.props

				if (!this.props.playlist) return null

				return (
					<ModalDialog
						title={t('Start time is close')}
						acceptText={t('Yes')}
						secondaryText={t('No')}
						onAccept={this.oneMinuteBeforeAction}
						onDiscard={this.discard}
						onSecondary={this.discard}
						show={
							this.props.studioMode &&
							this.state.plannedStartCloseShow &&
							!(this.props.playlist.activationId && !this.props.playlist.rehearsal) &&
							!!this.props.playlist.activationId
						}
					>
						<p>
							{t(
								'You are in rehearsal mode, the broadcast starts in less than 1 minute. Do you want to reset the rundown and go into On-Air mode?'
							)}
						</p>
					</ModalDialog>
				)
			}
		}
	)
)
interface ITimingDisplayProps {
	rundownPlaylist: RundownPlaylist
	currentRundown: Rundown | undefined
	rundownCount: number
	layout: RundownLayoutRundownHeader | undefined
}

const TimingDisplay = withTranslation()(
	withTiming<ITimingDisplayProps & WithTranslation, {}>()(
		class TimingDisplay extends React.Component<Translated<WithTiming<ITimingDisplayProps>>> {
			render() {
				const { t, rundownPlaylist, currentRundown } = this.props

				if (!rundownPlaylist) return null

				const expectedStart = PlaylistTiming.getExpectedStart(rundownPlaylist.timing)
				const expectedEnd = PlaylistTiming.getExpectedEnd(rundownPlaylist.timing)
				const expectedDuration = PlaylistTiming.getExpectedDuration(rundownPlaylist.timing)
				const showEndTiming =
					!this.props.timingDurations.rundownsBeforeNextBreak ||
					!this.props.layout?.showNextBreakTiming ||
					(this.props.timingDurations.rundownsBeforeNextBreak.length > 0 &&
						(!this.props.layout?.hideExpectedEndBeforeBreak ||
							(this.props.timingDurations.breakIsLastRundown && this.props.layout?.lastRundownIsNotBreak)))
				const showNextBreakTiming =
					rundownPlaylist.startedPlayback &&
					this.props.timingDurations.rundownsBeforeNextBreak?.length &&
					this.props.layout?.showNextBreakTiming &&
					!(this.props.timingDurations.breakIsLastRundown && this.props.layout.lastRundownIsNotBreak)

				return (
					<div className="timing mod">
						<PlaylistStartTiming rundownPlaylist={rundownPlaylist} hideDiff={true} />
						<RundownName
							rundownPlaylist={rundownPlaylist}
							currentRundown={currentRundown}
							rundownCount={this.props.rundownCount}
						/>
						<TimeOfDay />
						{rundownPlaylist.currentPartInstanceId && (
							<span className="timing-clock current-remaining">
								<CurrentPartRemaining
									currentPartInstanceId={rundownPlaylist.currentPartInstanceId}
									heavyClassName="overtime"
								/>
								<AutoNextStatus />
								{rundownPlaylist.holdState && rundownPlaylist.holdState !== RundownHoldState.COMPLETE ? (
									<div className="rundown__header-status rundown__header-status--hold">{t('Hold')}</div>
								) : null}
							</span>
						)}
						{showEndTiming ? (
							<PlaylistEndTiming
								rundownPlaylist={rundownPlaylist}
								loop={rundownPlaylist.loop}
								expectedStart={expectedStart}
								expectedEnd={expectedEnd}
								expectedDuration={expectedDuration}
								endLabel={this.props.layout?.plannedEndText}
								rundownCount={this.props.rundownCount}
							/>
						) : null}
						{showNextBreakTiming ? (
							<NextBreakTiming
								rundownsBeforeBreak={this.props.timingDurations.rundownsBeforeNextBreak!}
								breakText={this.props.layout?.nextBreakText}
								lastChild={!showEndTiming}
							/>
						) : null}
					</div>
				)
			}
		}
	)
)

interface IRundownHeaderProps {
	playlist: RundownPlaylist
	showStyleBase: ShowStyleBase
	showStyleVariant: ShowStyleVariant
	currentRundown: Rundown | undefined
	studio: Studio
	rundownIds: RundownId[]
	firstRundown: Rundown | undefined
	onActivate?: (isRehearsal: boolean) => void
	studioMode: boolean
	inActiveRundownView?: boolean
	layout: RundownLayoutRundownHeader | undefined
}

interface IRundownHeaderState {
	isError: boolean
	errorMessage?: string
	shouldQueue: boolean
	selectedPiece: BucketAdLibItem | IAdLibListItem | PieceUi | undefined
}

const RundownHeader = withTranslation()(
	class RundownHeader extends React.Component<Translated<IRundownHeaderProps>, IRundownHeaderState> {
		bindKeys: Array<{
			key: string
			up?: (e: KeyboardEvent) => any
			down?: (e: KeyboardEvent) => any
			label: string
			global?: boolean
			coolDown?: number
		}> = []
		constructor(props: Translated<IRundownHeaderProps>) {
			super(props)

			this.state = {
				isError: false,
				shouldQueue: false,
				selectedPiece: undefined,
			}
		}
		componentDidMount() {
			RundownViewEventBus.on(RundownViewEvents.ACTIVATE_RUNDOWN_PLAYLIST, this.eventActivate)
			RundownViewEventBus.on(RundownViewEvents.RESYNC_RUNDOWN_PLAYLIST, this.eventResync)
			RundownViewEventBus.on(RundownViewEvents.TAKE, this.eventTake)
			RundownViewEventBus.on(RundownViewEvents.RESET_RUNDOWN_PLAYLIST, this.eventResetRundownPlaylist)

			reloadRundownPlaylistClick.set(this.reloadRundownPlaylist)
		}

		componentWillUnmount() {
			RundownViewEventBus.off(RundownViewEvents.ACTIVATE_RUNDOWN_PLAYLIST, this.eventActivate)
			RundownViewEventBus.off(RundownViewEvents.RESYNC_RUNDOWN_PLAYLIST, this.eventResync)
			RundownViewEventBus.off(RundownViewEvents.TAKE, this.eventTake)
			RundownViewEventBus.off(RundownViewEvents.RESET_RUNDOWN_PLAYLIST, this.eventResetRundownPlaylist)
		}
		eventActivate = (e: ActivateRundownPlaylistEvent) => {
			if (e.rehearsal) {
				this.activateRehearsal(e.context)
			} else {
				this.activate(e.context)
			}
		}
		eventResync = (e: IEventContext) => {
			this.reloadRundownPlaylist(e.context)
		}
		eventTake = (e: IEventContext) => {
			this.take(e.context)
		}
		eventResetRundownPlaylist = (e: IEventContext) => {
			this.resetRundown(e.context)
		}

		handleDisableNextPiece = (err: ClientAPI.ClientResponse<undefined>) => {
			if (ClientAPI.isClientResponseError(err)) {
				const { t } = this.props

				if (err.error.key === UserErrorMessage.DisableNoPieceFound) {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.WARNING,
							t('Could not find a Piece that can be disabled.'),
							'userAction'
						)
					)
					return false
				}
			}
		}

		disableNextPiece = (e: any) => {
			const { t } = this.props

			if (this.props.studioMode) {
				doUserAction(
					t,
					e,
					UserAction.DISABLE_NEXT_PIECE,
					(e) => MeteorCall.userAction.disableNextPiece(e, this.props.playlist._id, false),
					this.handleDisableNextPiece
				)
			}
		}

		disableNextPieceUndo = (e: any) => {
			const { t } = this.props

			if (this.props.studioMode) {
				doUserAction(
					t,
					e,
					UserAction.DISABLE_NEXT_PIECE,
					(e) => MeteorCall.userAction.disableNextPiece(e, this.props.playlist._id, true),
					this.handleDisableNextPiece
				)
			}
		}

		take = (e: any) => {
			const { t } = this.props
			if (this.props.studioMode) {
				if (!this.props.playlist.activationId) {
					const onSuccess = () => {
						if (typeof this.props.onActivate === 'function') this.props.onActivate(false)
					}
					const handleResult = (err) => {
						if (!err) {
							onSuccess()
						} else if (ClientAPI.isClientResponseError(err)) {
							if (err.error.key === UserErrorMessage.RundownAlreadyActiveNames) {
								this.handleAnotherPlaylistActive(this.props.playlist._id, true, err.error, onSuccess)
								return false
							}
						}
					}
					// ask to activate
					doModalDialog({
						title: t('Failed to execute take'),
						message: t(
							'The rundown you are trying to execute a take on is inactive, would you like to activate this rundown?'
						),
						acceptOnly: false,
						warning: true,
						yes: t('Activate (Rehearsal)'),
						actions: [
							{
								label: t('Activate (On-Air)'),
								classNames: 'btn-primary',
								on: (e) => {
									doUserAction(
										t,
										e,
										UserAction.DEACTIVATE_OTHER_RUNDOWN_PLAYLIST,
										(e) => MeteorCall.userAction.forceResetAndActivate(e, this.props.playlist._id, false),
										handleResult
									)
								},
							},
						],
						onAccept: () => {
							// nothing
							doUserAction(
								t,
								e,
								UserAction.ACTIVATE_RUNDOWN_PLAYLIST,
								(e) => MeteorCall.userAction.activate(e, this.props.playlist._id, true),
								handleResult
							)
						},
					})
				} else {
					doUserAction(t, e, UserAction.TAKE, (e) =>
						MeteorCall.userAction.take(e, this.props.playlist._id, this.props.playlist.currentPartInstanceId)
					)
				}
			}
		}

		discardError = () => {
			this.setState({
				isError: false,
			})
		}

		hold = (e: any) => {
			const { t } = this.props
			if (this.props.studioMode && this.props.playlist.activationId) {
				doUserAction(t, e, UserAction.ACTIVATE_HOLD, (e) =>
					MeteorCall.userAction.activateHold(e, this.props.playlist._id, false)
				)
			}
		}

		holdUndo = (e: any) => {
			const { t } = this.props
			if (
				this.props.studioMode &&
				this.props.playlist.activationId &&
				this.props.playlist.holdState === RundownHoldState.PENDING
			) {
				doUserAction(t, e, UserAction.ACTIVATE_HOLD, (e) =>
					MeteorCall.userAction.activateHold(e, this.props.playlist._id, true)
				)
			}
		}

		rundownShouldHaveStarted() {
			return getCurrentTime() > (PlaylistTiming.getExpectedStart(this.props.playlist.timing) || 0)
		}
		rundownWillShortlyStart() {
			return (
				!this.rundownShouldHaveEnded() &&
				getCurrentTime() > (PlaylistTiming.getExpectedStart(this.props.playlist.timing) || 0) - REHEARSAL_MARGIN
			)
		}
		rundownShouldHaveEnded() {
			return (
				getCurrentTime() >
				(PlaylistTiming.getExpectedStart(this.props.playlist.timing) || 0) +
					(PlaylistTiming.getExpectedDuration(this.props.playlist.timing) || 0)
			)
		}

		handleAnotherPlaylistActive = (
			playlistId: RundownPlaylistId,
			rehersal: boolean,
			err: UserError,
			clb?: Function
		) => {
			const { t } = this.props

			function handleResult(err, response: void) {
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
						onAccept: () => {
							// nothing
						},
					})
				}
			}

			doModalDialog({
				title: t('Another Rundown is Already Active!'),
				message: t(
					'The rundown "{{rundownName}}" will need to be deactivated in order to activate this one.\n\nAre you sure you want to activate this one anyway?',
					{
						// TODO: this is a bit of a hack, could a better string sent from the server instead?
						rundownName: err.message.args?.names ?? '',
					}
				),
				yes: t('Activate Anyway (Rehearsal)'),
				no: t('Cancel'),
				actions: [
					{
						label: t('Activate Anyway (On-Air)'),
						classNames: 'btn-primary',
						on: (e) => {
							doUserAction(
								t,
								e,
								UserAction.DEACTIVATE_OTHER_RUNDOWN_PLAYLIST,
								(e) => MeteorCall.userAction.forceResetAndActivate(e, playlistId, false),
								handleResult
							)
						},
					},
				],
				warning: true,
				onAccept: (e) => {
					doUserAction(
						t,
						e,
						UserAction.DEACTIVATE_OTHER_RUNDOWN_PLAYLIST,
						(e) => MeteorCall.userAction.forceResetAndActivate(e, playlistId, rehersal),
						handleResult
					)
				},
			})
		}

		activate = (e: any) => {
			const { t } = this.props
			if (e.persist) e.persist()

			if (
				this.props.studioMode &&
				(!this.props.playlist.activationId || (this.props.playlist.activationId && this.props.playlist.rehearsal))
			) {
				const onSuccess = () => {
					this.deferFlushAndRewindSegments()
					if (typeof this.props.onActivate === 'function') this.props.onActivate(false)
				}
				const doActivate = () => {
					doUserAction(
						t,
						e,
						UserAction.ACTIVATE_RUNDOWN_PLAYLIST,
						(e) => MeteorCall.userAction.activate(e, this.props.playlist._id, false),
						(err) => {
							if (!err) {
								if (typeof this.props.onActivate === 'function') this.props.onActivate(false)
							} else if (ClientAPI.isClientResponseError(err)) {
								if (err.error.key === UserErrorMessage.RundownAlreadyActiveNames) {
									this.handleAnotherPlaylistActive(this.props.playlist._id, false, err.error, () => {
										if (typeof this.props.onActivate === 'function') this.props.onActivate(false)
									})
									return false
								}
							}
						}
					)
				}
				if (!this.rundownShouldHaveStarted()) {
					// The broadcast hasn't started yet
					doModalDialog({
						title: this.props.playlist.name,
						message: t('Do you want to activate this Rundown?'),
						yes: 'Activate (On-Air)',
						onAccept: () => {
							this.rewindSegments()
							doUserAction(
								t,
								e,
								UserAction.RESET_AND_ACTIVATE_RUNDOWN_PLAYLIST,
								(e) => MeteorCall.userAction.resetAndActivate(e, this.props.playlist._id),
								(err) => {
									if (!err) {
										onSuccess()
									} else if (ClientAPI.isClientResponseError(err)) {
										if (err.error.key === UserErrorMessage.RundownAlreadyActiveNames) {
											this.handleAnotherPlaylistActive(this.props.playlist._id, false, err.error, onSuccess)
											return false
										}
									}
								}
							)
						},
					})
				} else if (!this.rundownShouldHaveEnded()) {
					// The broadcast has started
					doActivate()
				} else {
					// The broadcast has ended, going into active mode is probably not what you want to do
					doModalDialog({
						title: this.props.playlist.name,
						message: t('The planned end time has passed, are you sure you want to activate this Rundown?'),
						yes: 'Activate (On-Air)',
						onAccept: () => {
							doActivate()
						},
					})
				}
			}
		}
		activateRehearsal = (e: any) => {
			const { t } = this.props
			if (e.persist) e.persist()

			if (
				this.props.studioMode &&
				(!this.props.playlist.activationId || (this.props.playlist.activationId && !this.props.playlist.rehearsal))
			) {
				const onSuccess = () => {
					if (typeof this.props.onActivate === 'function') this.props.onActivate(false)
				}
				const doActivateRehersal = () => {
					doUserAction(
						t,
						e,
						UserAction.ACTIVATE_RUNDOWN_PLAYLIST,
						(e) => MeteorCall.userAction.activate(e, this.props.playlist._id, true),
						(err) => {
							if (!err) {
								onSuccess()
							} else if (ClientAPI.isClientResponseError(err)) {
								if (err.error.key === UserErrorMessage.RundownAlreadyActiveNames) {
									this.handleAnotherPlaylistActive(this.props.playlist._id, true, err.error, onSuccess)
									return false
								}
							}
						}
					)
				}
				if (!this.rundownShouldHaveStarted()) {
					// The broadcast hasn't started yet
					if (!this.props.playlist.activationId) {
						// inactive, do the full preparation:
						doUserAction(
							t,
							e,
							UserAction.PREPARE_FOR_BROADCAST,
							(e) => MeteorCall.userAction.prepareForBroadcast(e, this.props.playlist._id),
							(err) => {
								if (!err) {
									onSuccess()
								} else if (ClientAPI.isClientResponseError(err)) {
									if (err.error.key === UserErrorMessage.RundownAlreadyActiveNames) {
										this.handleAnotherPlaylistActive(this.props.playlist._id, true, err.error, onSuccess)
										return false
									}
								}
							}
						)
					} else if (!this.props.playlist.rehearsal) {
						// Active, and not in rehearsal
						doModalDialog({
							title: this.props.playlist.name,
							message: t('Are you sure you want to activate Rehearsal Mode?'),
							yes: 'Activate (Rehearsal)',
							onAccept: () => {
								doActivateRehersal()
							},
						})
					} else {
						// Already in rehersal, do nothing
					}
				} else {
					// The broadcast has started
					if (!this.rundownShouldHaveEnded()) {
						// We are in the broadcast
						doModalDialog({
							title: this.props.playlist.name,
							message: t('Are you sure you want to activate Rehearsal Mode?'),
							yes: 'Activate (Rehearsal)',
							onAccept: () => {
								doActivateRehersal()
							},
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

			if (this.props.studioMode && this.props.playlist.activationId) {
				if (this.rundownShouldHaveStarted()) {
					if (this.props.playlist.rehearsal) {
						// We're in rehearsal mode
						doUserAction(t, e, UserAction.DEACTIVATE_RUNDOWN_PLAYLIST, (e) =>
							MeteorCall.userAction.deactivate(e, this.props.playlist._id)
						)
					} else {
						doModalDialog({
							title: this.props.playlist.name,
							message: t('Are you sure you want to deactivate this Rundown?\n(This will clear the outputs)'),
							warning: true,
							onAccept: () => {
								doUserAction(t, e, UserAction.DEACTIVATE_RUNDOWN_PLAYLIST, (e) =>
									MeteorCall.userAction.deactivate(e, this.props.playlist._id)
								)
							},
						})
					}
				} else {
					// Do it right away
					doUserAction(t, e, UserAction.DEACTIVATE_RUNDOWN_PLAYLIST, (e) =>
						MeteorCall.userAction.deactivate(e, this.props.playlist._id)
					)
				}
			}
		}

		resetRundown = (e: any) => {
			const { t } = this.props
			if (e.persist) e.persist()

			const doReset = () => {
				this.rewindSegments() // Do a rewind right away
				doUserAction(
					t,
					e,
					UserAction.RESET_RUNDOWN_PLAYLIST,
					(e) => MeteorCall.userAction.resetRundownPlaylist(e, this.props.playlist._id),
					() => {
						this.deferFlushAndRewindSegments()
					}
				)
			}
			if (
				this.props.playlist.activationId &&
				!this.props.playlist.rehearsal &&
				!this.props.studio.settings.allowRundownResetOnAir
			) {
				// The rundown is active and not in rehersal
				doModalDialog({
					title: this.props.playlist.name,
					message: t('The rundown can not be reset while it is active'),
					onAccept: () => {
						// nothing
					},
					acceptOnly: true,
					yes: 'OK',
				})
			} else {
				doReset()
			}
		}

		reloadRundownPlaylist = (e: any) => {
			const { t } = this.props
			if (this.props.studioMode) {
				doUserAction(
					t,
					e,
					UserAction.RELOAD_RUNDOWN_PLAYLIST_DATA,
					(e) => MeteorCall.userAction.resyncRundownPlaylist(e, this.props.playlist._id),
					(err, reloadResponse) => {
						if (!err && reloadResponse) {
							if (!handleRundownPlaylistReloadResponse(t, reloadResponse)) {
								if (this.props.playlist && this.props.playlist.nextPartInstanceId) {
									scrollToPartInstance(this.props.playlist.nextPartInstanceId).catch((error) => {
										if (!error.toString().match(/another scroll/)) console.warn(error)
									})
								}
							}
						}
					}
				)
			}
		}

		takeRundownSnapshot = (e) => {
			const { t } = this.props
			if (this.props.studioMode) {
				const doneMessage = t('A snapshot of the current Running\xa0Order has been created for troubleshooting.')
				doUserAction(
					t,
					e,
					UserAction.CREATE_SNAPSHOT_FOR_DEBUG,
					(e) => MeteorCall.userAction.storeRundownSnapshot(e, this.props.playlist._id, 'Taken by user'),
					() => {
						NotificationCenter.push(
							new Notification(
								undefined,
								NoticeLevel.NOTIFICATION,
								doneMessage,
								'userAction',
								undefined,
								false,
								undefined,
								undefined,
								5000
							)
						)
						return false
					},
					doneMessage
				)
			}
		}

		resetAndActivateRundown = (e: any) => {
			// Called from the ModalDialog, 1 minute before broadcast starts
			if (this.props.studioMode) {
				const { t } = this.props
				this.rewindSegments() // Do a rewind right away

				doUserAction(
					t,
					e,
					UserAction.RESET_AND_ACTIVATE_RUNDOWN_PLAYLIST,
					(e) => MeteorCall.userAction.resetAndActivate(e, this.props.playlist._id),
					(err) => {
						if (!err) {
							this.deferFlushAndRewindSegments()
							if (typeof this.props.onActivate === 'function') this.props.onActivate(false)
						}
					}
				)
			}
		}

		rewindSegments() {
			RundownViewEventBus.emit(RundownViewEvents.REWIND_SEGMENTS)
		}
		deferFlushAndRewindSegments() {
			// Do a rewind later, when the UI has updated
			Meteor.defer(() => {
				Tracker.flush()
				Meteor.setTimeout(() => {
					this.rewindSegments()
					RundownViewEventBus.emit(RundownViewEvents.GO_TO_TOP)
				}, 500)
			})
		}

		changeQueueAdLib = (shouldQueue: boolean) => {
			this.setState({
				shouldQueue,
			})
		}

		selectPiece = (piece: BucketAdLibItem | IAdLibListItem | PieceUi | undefined) => {
			this.setState({
				selectedPiece: piece,
			})
		}

		render() {
			const { t } = this.props
			return (
				<>
					<Escape to="document">
						<ContextMenu id="rundown-context-menu">
							<div className="react-contextmenu-label">{this.props.playlist && this.props.playlist.name}</div>
							{this.props.studioMode ? (
								<React.Fragment>
									{!(this.props.playlist.activationId && this.props.playlist.rehearsal) ? (
										!this.rundownShouldHaveStarted() && !this.props.playlist.activationId ? (
											<MenuItem onClick={(e) => this.activateRehearsal(e)}>
												{t('Prepare Studio and Activate (Rehearsal)')}
											</MenuItem>
										) : (
											<MenuItem onClick={(e) => this.activateRehearsal(e)}>{t('Activate (Rehearsal)')}</MenuItem>
										)
									) : (
										<MenuItem onClick={(e) => this.activate(e)}>{t('Activate (On-Air)')}</MenuItem>
									)}
									{this.rundownWillShortlyStart() && !this.props.playlist.activationId && (
										<MenuItem onClick={(e) => this.activate(e)}>{t('Activate (On-Air)')}</MenuItem>
									)}
									{this.props.playlist.activationId ? (
										<MenuItem onClick={(e) => this.deactivate(e)}>{t('Deactivate')}</MenuItem>
									) : null}
									{this.props.playlist.activationId ? (
										<MenuItem onClick={(e) => this.take(e)}>{t('Take')}</MenuItem>
									) : null}
									{this.props.playlist.activationId ? (
										<MenuItem onClick={(e) => this.hold(e)}>{t('Hold')}</MenuItem>
									) : null}
									{!(
										this.props.playlist.activationId &&
										!this.props.playlist.rehearsal &&
										!this.props.studio.settings.allowRundownResetOnAir
									) ? (
										<MenuItem onClick={(e) => this.resetRundown(e)}>{t('Reset Rundown')}</MenuItem>
									) : null}
									<MenuItem onClick={(e) => this.reloadRundownPlaylist(e)}>
										{t('Reload {{nrcsName}} Data', {
											nrcsName: (this.props.firstRundown && this.props.firstRundown.externalNRCSName) || 'NRCS',
										})}
									</MenuItem>
									<MenuItem onClick={(e) => this.takeRundownSnapshot(e)}>{t('Store Snapshot')}</MenuItem>
								</React.Fragment>
							) : (
								<React.Fragment>
									<MenuItem>{t('No actions available')}</MenuItem>
								</React.Fragment>
							)}
						</ContextMenu>
					</Escape>
					<div
						className={ClassNames('header rundown', {
							active: !!this.props.playlist.activationId,
							'not-active': !this.props.playlist.activationId,
							rehearsal: this.props.playlist.rehearsal,
						})}
					>
						<ContextMenuTrigger
							id="rundown-context-menu"
							attributes={{
								className: 'flex-col col-timing horizontal-align-center',
							}}
							holdToDisplay={contextMenuHoldToDisplayTime()}
						>
							<WarningDisplay
								studioMode={this.props.studioMode}
								inActiveRundownView={this.props.inActiveRundownView}
								playlist={this.props.playlist}
								oneMinuteBeforeAction={this.resetAndActivateRundown}
							/>
							<div className="row flex-row first-row super-dark">
								<div className="flex-col left horizontal-align-left">
									<div className="badge mod">
										<Tooltip
											overlay={t('Add ?studio=1 to the URL to enter studio mode')}
											visible={getHelpMode() && !getAllowStudio()}
											placement="bottom"
										>
											<div className="media-elem mrs sofie-logo" />
										</Tooltip>
										<div className="bd mls">
											<span className="logo-text"></span>
										</div>
									</div>
								</div>
								{this.props.layout && RundownLayoutsAPI.isDashboardLayout(this.props.layout) ? (
									<ShelfDashboardLayout
										rundownLayout={this.props.layout}
										playlist={this.props.playlist}
										showStyleBase={this.props.showStyleBase}
										showStyleVariant={this.props.showStyleVariant}
										studio={this.props.studio}
										studioMode={this.props.studioMode}
										shouldQueue={this.state.shouldQueue}
										onChangeQueueAdLib={this.changeQueueAdLib}
										selectedPiece={this.state.selectedPiece}
										onSelectPiece={this.selectPiece}
									/>
								) : (
									<>
										<TimingDisplay
											rundownPlaylist={this.props.playlist}
											currentRundown={this.props.currentRundown}
											rundownCount={this.props.rundownIds.length}
											layout={this.props.layout}
										/>
										<RundownSystemStatus
											studio={this.props.studio}
											playlist={this.props.playlist}
											rundownIds={this.props.rundownIds}
											firstRundown={this.props.firstRundown}
										/>
									</>
								)}
								<div className="flex-col right horizontal-align-right">
									<div className="links mod close">
										<NavLink to="/rundowns" title={t('Exit')}>
											<CoreIcon.NrkClose />
										</NavLink>
									</div>
								</div>
							</div>
						</ContextMenuTrigger>
					</div>
					<ModalDialog
						title={t('Error')}
						acceptText={t('OK')}
						show={!!this.state.isError}
						onAccept={this.discardError}
						onDiscard={this.discardError}
					>
						<p>{this.state.errorMessage}</p>
					</ModalDialog>
				</>
			)
		}
	}
)

interface IProps {
	match?: {
		params: {
			playlistId: RundownPlaylistId
		}
	}
	playlistId?: RundownPlaylistId
	inActiveRundownView?: boolean
	onlyShelf?: boolean
}

export interface IContextMenuContext {
	segment?: SegmentUi
	part?: PartUi | null

	partDocumentOffset?: OffsetPosition
	timeScale?: number
	mousePosition?: OffsetPosition
	partStartsAt?: number
}

interface IState {
	timeScale: number
	studioMode: boolean
	contextMenuContext: IContextMenuContext | null
	bottomMargin: string
	followLiveSegments: boolean
	manualSetAsNext: boolean
	subsReady: boolean
	isNotificationsCenterOpen: NoticeLevel | undefined
	isSupportPanelOpen: boolean
	isInspectorShelfExpanded: boolean
	isClipTrimmerOpen: boolean
	selectedPiece: AdLibPieceUi | PieceUi | undefined
	shelfLayout: RundownLayoutShelfBase | undefined
	rundownViewLayout: RundownViewLayout | undefined
	rundownHeaderLayout: RundownLayoutRundownHeader | undefined
	miniShelfLayout: RundownLayoutShelfBase | undefined
	currentRundown: Rundown | undefined
	/** Tracks whether the user has resized the shelf to prevent using default shelf settings */
	wasShelfResizedByUser: boolean
	segmentViewModes: Record<string, SegmentViewMode>
}

export type MinimalRundown = Pick<Rundown, '_id' | 'name' | 'timing' | 'showStyleBaseId' | 'endOfRundownIsShowBreak'>

type MatchedSegment = {
	rundown: MinimalRundown
	segments: Segment[]
	segmentIdsBeforeEachSegment: Set<SegmentId>[]
}

interface ITrackedProps {
	rundownPlaylistId: RundownPlaylistId
	rundowns: Rundown[]
	playlist?: RundownPlaylist
	currentRundown?: Rundown
	matchedSegments: MatchedSegment[]
	rundownsToShowstyles: Map<RundownId, ShowStyleBaseId>
	studio?: Studio
	showStyleBase?: ShowStyleBase
	showStyleVariant?: ShowStyleVariant
	rundownLayouts?: Array<RundownLayoutBase>
	buckets: Bucket[]
	casparCGPlayoutDevices?: PeripheralDevice[]
	shelfLayoutId?: RundownLayoutId
	rundownViewLayoutId?: RundownLayoutId
	rundownHeaderLayoutId?: RundownLayoutId
	miniShelfLayoutId?: RundownLayoutId
	shelfDisplayOptions: {
		buckets: boolean
		layout: boolean
		inspector: boolean
	}
	bucketDisplayFilter: number[] | undefined
	currentPartInstance: PartInstance | undefined
	nextPartInstance: PartInstance | undefined
	currentSegmentPartIds: PartId[]
	nextSegmentPartIds: PartId[]
}
export const RundownView = translateWithTracker<IProps, IState, ITrackedProps>((props: IProps) => {
	let playlistId
	if (props.match && props.match.params.playlistId) {
		playlistId = decodeURIComponent(unprotectString(props.match.params.playlistId))
	} else if (props.playlistId) {
		playlistId = props.playlistId
	}

	const playlist = RundownPlaylists.findOne(playlistId)
	let rundowns: Rundown[] = []
	let studio: Studio | undefined
	let currentPartInstance: PartInstance | undefined
	let nextPartInstance: PartInstance | undefined
	let currentRundown: Rundown | undefined = undefined

	if (playlist) {
		studio = Studios.findOne({ _id: playlist.studioId })
		rundowns = memoizedIsolatedAutorun(
			(_playlistId) => RundownPlaylistCollectionUtil.getRundowns(playlist),
			'playlist.getRundowns',
			playlistId
		)
		;({ currentPartInstance, nextPartInstance } = RundownPlaylistCollectionUtil.getSelectedPartInstances(playlist))
		const somePartInstance = currentPartInstance || nextPartInstance
		if (somePartInstance) {
			currentRundown = rundowns.find((rundown) => rundown._id === somePartInstance?.rundownId)
		}
	}

	const params = queryStringParse(location.search)

	const DEFAULT_DISPLAY_OPTIONS = props.onlyShelf ? 'layout,shelfLayout' : 'buckets,layout,shelfLayout,inspector'

	const displayOptions = ((params['display'] as string) || DEFAULT_DISPLAY_OPTIONS).split(',')
	const bucketDisplayFilter = !(params['buckets'] as string)
		? undefined
		: (params['buckets'] as string).split(',').map((v) => parseInt(v))

	const rundownsToShowstyles: Map<RundownId, ShowStyleBaseId> = new Map()
	for (const rundown of rundowns) {
		rundownsToShowstyles.set(rundown._id, rundown.showStyleBaseId)
	}

	// let rundownDurations = calculateDurations(rundown, parts)
	return {
		rundownPlaylistId: playlistId,
		rundowns,
		currentRundown,
		matchedSegments: playlist
			? RundownPlaylistCollectionUtil.getRundownsAndSegments(playlist, {
					isHidden: {
						$ne: true,
					},
			  }).map((input, rundownIndex, rundownArray) => ({
					...input,
					segmentIdsBeforeEachSegment: input.segments.map(
						(segment, segmentIndex, segmentArray) =>
							new Set([
								...(_.flatten(
									rundownArray.slice(0, rundownIndex).map((match) => match.segments.map((segment) => segment._id))
								) as SegmentId[]),
								...segmentArray.slice(0, segmentIndex).map((segment) => segment._id),
							])
					),
			  }))
			: [],
		rundownsToShowstyles,
		playlist,
		studio: studio,
		showStyleBase: rundowns.length > 0 ? ShowStyleBases.findOne(rundowns[0].showStyleBaseId) : undefined,
		showStyleVariant: rundowns.length > 0 ? ShowStyleVariants.findOne(rundowns[0].showStyleVariantId) : undefined,
		rundownLayouts:
			rundowns.length > 0 ? RundownLayouts.find({ showStyleBaseId: rundowns[0].showStyleBaseId }).fetch() : undefined,
		buckets:
			(playlist &&
				Buckets.find(
					{
						studioId: playlist.studioId,
					},
					{
						sort: {
							_rank: 1,
						},
					}
				).fetch()) ||
			[],
		casparCGPlayoutDevices:
			(studio &&
				PeripheralDevices.find({
					parentDeviceId: {
						$in: PeripheralDevices.find({
							studioId: studio._id,
						})
							.fetch()
							.map((i) => i._id),
					},
					type: PeripheralDeviceType.PLAYOUT,
					subType: TSR.DeviceType.CASPARCG,
				}).fetch()) ||
			undefined,
		shelfLayoutId: protectString((params['layout'] as string) || (params['shelfLayout'] as string) || ''), // 'layout' kept for backwards compatibility
		rundownViewLayoutId: protectString((params['rundownViewLayout'] as string) || ''),
		rundownHeaderLayoutId: protectString((params['rundownHeaderLayout'] as string) || ''),
		miniShelfLayoutId: protectString((params['miniShelfLayout'] as string) || ''),
		shelfDisplayOptions: {
			buckets: displayOptions.includes('buckets'),
			layout: displayOptions.includes('layout') || displayOptions.includes('shelfLayout'),
			inspector: displayOptions.includes('inspector'),
		},
		bucketDisplayFilter,
		currentPartInstance,
		nextPartInstance,
		currentSegmentPartIds: currentPartInstance
			? Parts.find(
					{
						segmentId: currentPartInstance?.part.segmentId,
					},
					{
						fields: {
							_id: 1,
						},
					}
			  ).map((part) => part._id)
			: [],
		nextSegmentPartIds: nextPartInstance
			? Parts.find(
					{
						segmentId: nextPartInstance?.part.segmentId,
					},
					{
						fields: {
							_id: 1,
						},
					}
			  ).map((part) => part._id)
			: [],
	}
})(
	class RundownView extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
		private _hideNotificationsAfterMount: number | undefined

		constructor(props: Translated<IProps & ITrackedProps>) {
			super(props)

			const shelfLayout = this.props.rundownLayouts?.find((layout) => layout._id === this.props.shelfLayoutId)
			let isInspectorShelfExpanded = false

			if (shelfLayout && RundownLayoutsAPI.isLayoutForShelf(shelfLayout)) {
				isInspectorShelfExpanded = shelfLayout.openByDefault
			}

			this.state = {
				timeScale: MAGIC_TIME_SCALE_FACTOR * Settings.defaultTimeScale,
				studioMode: getAllowStudio(),
				contextMenuContext: null,
				bottomMargin: '',
				followLiveSegments: true,
				manualSetAsNext: false,
				subsReady: false,
				isNotificationsCenterOpen: undefined,
				isSupportPanelOpen: false,
				isInspectorShelfExpanded,
				isClipTrimmerOpen: false,
				selectedPiece: undefined,
				shelfLayout: undefined,
				rundownViewLayout: undefined,
				rundownHeaderLayout: undefined,
				miniShelfLayout: undefined,
				currentRundown: undefined,
				wasShelfResizedByUser: false,
				segmentViewModes: this.props.playlist?._id
					? UIStateStorage.getItemRecord(`rundownView.${this.props.playlist._id}`, `segmentViewModes`, {})
					: {},
			}
		}

		static getDerivedStateFromProps(props: Translated<IProps & ITrackedProps>): Partial<IState> {
			let selectedShelfLayout: RundownLayoutBase | undefined = undefined
			let selectedViewLayout: RundownViewLayout | undefined = undefined
			let selectedHeaderLayout: RundownLayoutBase | undefined = undefined
			let selectedMiniShelfLayout: RundownLayoutBase | undefined = undefined

			if (props.rundownLayouts) {
				// first try to use the one selected by the user
				if (props.shelfLayoutId) {
					selectedShelfLayout = props.rundownLayouts.find((i) => i._id === props.shelfLayoutId)
				}

				if (props.rundownViewLayoutId) {
					selectedViewLayout = props.rundownLayouts.find(
						(i) => i._id === props.rundownViewLayoutId && RundownLayoutsAPI.isRundownViewLayout(i)
					) as RundownViewLayout
				}

				if (props.rundownHeaderLayoutId) {
					selectedHeaderLayout = props.rundownLayouts.find((i) => i._id === props.rundownHeaderLayoutId)
				}

				if (props.miniShelfLayoutId) {
					selectedMiniShelfLayout = props.rundownLayouts.find((i) => i._id === props.miniShelfLayoutId)
				}

				// if couldn't find based on id, try matching part of the name
				if (props.shelfLayoutId && !selectedShelfLayout) {
					selectedShelfLayout = props.rundownLayouts.find(
						(i) => i.name.indexOf(unprotectString(props.shelfLayoutId!)) >= 0
					)
				}

				if (props.rundownViewLayoutId && !selectedViewLayout) {
					selectedViewLayout = props.rundownLayouts.find(
						(i) =>
							i.name.indexOf(unprotectString(props.rundownViewLayoutId!)) >= 0 &&
							RundownLayoutsAPI.isRundownViewLayout(i)
					) as RundownViewLayout
				}

				if (props.rundownHeaderLayoutId && !selectedHeaderLayout) {
					selectedHeaderLayout = props.rundownLayouts.find(
						(i) => i.name.indexOf(unprotectString(props.rundownHeaderLayoutId!)) >= 0
					)
				}

				if (props.miniShelfLayoutId && !selectedMiniShelfLayout) {
					selectedMiniShelfLayout = props.rundownLayouts.find(
						(i) => i.name.indexOf(unprotectString(props.miniShelfLayoutId!)) >= 0
					)
				}

				// Try to load defaults from rundown view layouts
				if (selectedViewLayout && RundownLayoutsAPI.isLayoutForRundownView(selectedViewLayout)) {
					const rundownLayout = selectedViewLayout as RundownViewLayout
					if (!selectedShelfLayout && rundownLayout.shelfLayout) {
						selectedShelfLayout = props.rundownLayouts.find((i) => i._id === rundownLayout.shelfLayout)
					}

					if (!selectedMiniShelfLayout && rundownLayout.miniShelfLayout) {
						selectedMiniShelfLayout = props.rundownLayouts.find((i) => i._id === rundownLayout.miniShelfLayout)
					}

					if (!selectedHeaderLayout && rundownLayout.rundownHeaderLayout) {
						selectedHeaderLayout = props.rundownLayouts.find((i) => i._id === rundownLayout.rundownHeaderLayout)
					}
				}

				// if not, try the first RUNDOWN_LAYOUT available
				if (!selectedShelfLayout) {
					selectedShelfLayout = props.rundownLayouts.find((i) => i.type === RundownLayoutType.RUNDOWN_LAYOUT)
				}

				// if still not found, use the first one - this is a fallback functionality reserved for Shelf layouts
				// To be removed once Rundown View Layouts/Shelf layouts are refactored
				if (!selectedShelfLayout) {
					selectedShelfLayout = props.rundownLayouts.find((i) => RundownLayoutsAPI.isLayoutForShelf(i))
				}
			}

			let currentRundown: Rundown | undefined = undefined
			if (props.playlist && props.rundowns.length > 0 && (props.currentPartInstance || props.nextPartInstance)) {
				currentRundown = props.rundowns.find((rundown) => rundown._id === props.currentPartInstance?.rundownId)
				if (!currentRundown) {
					currentRundown = props.rundowns.find((rundown) => rundown._id === props.nextPartInstance?.rundownId)
				}
			}

			return {
				shelfLayout:
					selectedShelfLayout && RundownLayoutsAPI.isLayoutForShelf(selectedShelfLayout)
						? selectedShelfLayout
						: undefined,
				rundownViewLayout:
					selectedViewLayout && RundownLayoutsAPI.isLayoutForRundownView(selectedViewLayout)
						? selectedViewLayout
						: undefined,
				rundownHeaderLayout:
					selectedHeaderLayout && RundownLayoutsAPI.isLayoutForRundownHeader(selectedHeaderLayout)
						? selectedHeaderLayout
						: undefined,
				miniShelfLayout:
					selectedMiniShelfLayout && RundownLayoutsAPI.isLayoutForMiniShelf(selectedMiniShelfLayout)
						? selectedMiniShelfLayout
						: undefined,
				currentRundown,
			}
		}

		componentDidMount() {
			const playlistId = this.props.rundownPlaylistId

			this.subscribe(PubSub.rundownPlaylists, {
				_id: playlistId,
			})
			this.subscribe(PubSub.rundowns, {
				playlistId,
			})
			this.autorun(() => {
				const playlist = RundownPlaylists.findOne(playlistId, {
					fields: {
						_id: 1,
						studioId: 1,
					},
				}) as Pick<RundownPlaylist, '_id' | 'studioId'> | undefined
				if (!playlist) return

				this.subscribe(PubSub.studios, {
					_id: playlist.studioId,
				})
				this.subscribe(PubSub.buckets, {
					studioId: playlist.studioId,
				})
				// TODO: This is a hack, which should be replaced by something more clever, like in withMediaObjectStatus()
				this.subscribe(PubSub.packageContainerPackageStatuses, playlist.studioId)
			})

			this.autorun(() => {
				const playlist = RundownPlaylists.findOne(playlistId, {
					fields: {
						_id: 1,
					},
				}) as Pick<RundownPlaylist, '_id' | 'activationId'> | undefined
				if (!playlist) return

				const rundowns = RundownPlaylistCollectionUtil.getRundowns(playlist, undefined, {
					fields: {
						_id: 1,
						showStyleBaseId: 1,
						showStyleVariantId: 1,
					},
				}) as Pick<Rundown, '_id' | 'showStyleBaseId' | 'showStyleVariantId'>[]
				this.subscribe(PubSub.showStyleBases, {
					_id: {
						$in: rundowns.map((i) => i.showStyleBaseId),
					},
				})
				this.subscribe(PubSub.showStyleVariants, {
					_id: {
						$in: rundowns.map((i) => i.showStyleVariantId),
					},
				})
				this.subscribe(PubSub.rundownLayouts, {
					showStyleBaseId: {
						$in: rundowns.map((i) => i.showStyleBaseId),
					},
				})
				const rundownIDs = rundowns.map((i) => i._id)
				this.subscribe(PubSub.segments, {
					rundownId: {
						$in: rundownIDs,
					},
				})
				this.subscribe(PubSub.adLibPieces, {
					rundownId: {
						$in: rundownIDs,
					},
				})
				this.subscribe(PubSub.rundownBaselineAdLibPieces, {
					rundownId: {
						$in: rundownIDs,
					},
				})
				this.subscribe(PubSub.adLibActions, {
					rundownId: {
						$in: rundownIDs,
					},
				})
				this.subscribe(PubSub.rundownBaselineAdLibActions, {
					rundownId: {
						$in: rundownIDs,
					},
				})
				this.subscribe(PubSub.parts, {
					rundownId: {
						$in: rundownIDs,
					},
				})
				this.subscribe(PubSub.partInstances, {
					rundownId: {
						$in: rundownIDs,
					},
					playlistActivationId: playlist.activationId,
					reset: {
						$ne: true,
					},
				})
			})
			this.autorun(() => {
				const playlist = RundownPlaylists.findOne(playlistId, {
					fields: {
						currentPartInstanceId: 1,
						nextPartInstanceId: 1,
						previousPartInstanceId: 1,
					},
				}) as
					| Pick<RundownPlaylist, '_id' | 'currentPartInstanceId' | 'nextPartInstanceId' | 'previousPartInstanceId'>
					| undefined
				if (playlist) {
					const rundownIds = RundownPlaylistCollectionUtil.getRundownUnorderedIDs(playlist)
					// Use Meteor.subscribe so that this subscription doesn't mess with this.subscriptionsReady()
					// it's run in this.autorun, so the subscription will be stopped along with the autorun,
					// so we don't have to manually clean up after ourselves.
					Meteor.subscribe(PubSub.pieceInstances, {
						rundownId: {
							$in: rundownIds,
						},
						partInstanceId: {
							$in: [
								playlist.currentPartInstanceId,
								playlist.nextPartInstanceId,
								playlist.previousPartInstanceId,
							].filter((p) => p !== null),
						},
						reset: {
							$ne: true,
						},
					})
				}
			})
			this.autorun(() => {
				const subsReady = this.subscriptionsReady()
				if (subsReady !== this.state.subsReady) {
					this.setState({
						subsReady: subsReady,
					})
				}
			})

			document.body.classList.add('dark', 'vertical-overflow-only')

			rundownNotificationHandler.set(this.onRONotificationClick)

			RundownViewEventBus.on(RundownViewEvents.GO_TO_LIVE_SEGMENT, this.onGoToLiveSegment)
			RundownViewEventBus.on(RundownViewEvents.GO_TO_TOP, this.onGoToTop)

			if (this.props.playlist) {
				documentTitle.set(this.props.playlist.name)
			}

			const themeColor = document.head.querySelector('meta[name="theme-color"]')
			if (themeColor) {
				themeColor.setAttribute('data-content', themeColor.getAttribute('content') || '')
				themeColor.setAttribute('content', '#000000')
			}

			// Snooze notifications for a period after mounting the RundownView
			if (HIDE_NOTIFICATIONS_AFTER_MOUNT) {
				NotificationCenter.isOpen = true
				this._hideNotificationsAfterMount = Meteor.setTimeout(() => {
					NotificationCenter.isOpen = this.state.isNotificationsCenterOpen !== undefined
					this._hideNotificationsAfterMount = undefined
				}, HIDE_NOTIFICATIONS_AFTER_MOUNT)
			}
			NotificationCenter.isConcentrationMode = true
		}

		componentDidUpdate(prevProps: IProps & ITrackedProps, prevState: IState) {
			if (!this.props.onlyShelf) {
				if (
					this.props.playlist &&
					prevProps.playlist &&
					prevProps.playlist.currentPartInstanceId !== this.props.playlist.currentPartInstanceId &&
					prevProps.playlist.nextPartManual
				) {
					// reset followLiveSegments after a manual set as next
					this.setState({
						manualSetAsNext: false,
						followLiveSegments: true,
					})
					if (this.props.playlist.currentPartInstanceId) {
						scrollToPartInstance(this.props.playlist.currentPartInstanceId, true).catch((error) => {
							if (!error.toString().match(/another scroll/)) console.warn(error)
						})
					}
				} else if (
					this.props.playlist &&
					prevProps.playlist &&
					prevProps.playlist.activationId &&
					!this.props.playlist.activationId
				) {
					// reset followLiveSegments after deactivating a rundown
					this.setState({
						followLiveSegments: true,
					})
				} else if (
					this.props.playlist &&
					prevProps.playlist &&
					!prevProps.playlist.activationId &&
					this.props.playlist.activationId &&
					this.props.playlist.nextPartInstanceId
				) {
					// scroll to next after activation
					scrollToPartInstance(this.props.playlist.nextPartInstanceId).catch((error) => {
						if (!error.toString().match(/another scroll/)) console.warn(error)
					})
				} else if (
					// after take
					this.props.playlist &&
					prevProps.playlist &&
					this.props.playlist.currentPartInstanceId !== prevProps.playlist.currentPartInstanceId &&
					this.props.playlist.currentPartInstanceId &&
					this.state.followLiveSegments
				) {
					scrollToPartInstance(this.props.playlist.currentPartInstanceId, true).catch((error) => {
						if (!error.toString().match(/another scroll/)) console.warn(error)
					})
				} else if (
					this.props.playlist &&
					prevProps.playlist &&
					this.props.playlist.nextPartInstanceId !== prevProps.playlist.nextPartInstanceId &&
					this.props.playlist.currentPartInstanceId === prevProps.playlist.currentPartInstanceId &&
					this.props.playlist.nextPartInstanceId &&
					this.props.playlist.nextPartManual
				) {
					scrollToPartInstance(this.props.playlist.nextPartInstanceId, false).catch((error) => {
						if (!error.toString().match(/another scroll/)) console.warn(error)
					})
				} else if (
					// initial Rundown open
					this.props.playlist &&
					this.props.playlist.currentPartInstanceId &&
					this.state.subsReady &&
					!prevState.subsReady
				) {
					// allow for some time for the Rundown to render
					maintainFocusOnPartInstance(this.props.playlist.currentPartInstanceId, 7000, true, true)
				}
			}

			if (
				typeof this.props.playlist !== typeof prevProps.playlist ||
				this.props.playlist?._id !== prevProps.playlist?._id ||
				!!this.props.playlist?.activationId !== !!prevProps.playlist?.activationId ||
				this.state.studioMode !== prevState.studioMode
			) {
				if (this.props.playlist && this.props.playlist.activationId && this.state.studioMode && !getAllowDeveloper()) {
					window.addEventListener('beforeunload', this.onBeforeUnload)
				} else {
					window.removeEventListener('beforeunload', this.onBeforeUnload)
				}
			}

			if (
				this.props.playlist &&
				(prevProps.playlist === undefined || this.props.playlist._id !== prevProps.playlist._id)
			) {
				this.setState({
					segmentViewModes: this.props.playlist?._id
						? UIStateStorage.getItemRecord(`rundownView.${this.props.playlist._id}`, `segmentViewModes`, {})
						: {},
				})
			}

			if (this.props.playlist?.name !== prevProps.playlist?.name) {
				if (this.props.playlist?.name) {
					documentTitle.set(this.props.playlist.name)
				} else {
					documentTitle.set(null)
				}
			}
			if (Settings.enableUserAccounts && getAllowStudio() !== this.state.studioMode) {
				this.setState({ studioMode: getAllowStudio() })
			}
		}

		onSelectPiece = (piece: PieceUi) => {
			if (piece) {
				const vtContent = piece.instance.piece.content as VTContent | undefined
				if (
					vtContent &&
					vtContent.editable &&
					(vtContent.editable.editorialDuration !== undefined || vtContent.editable.editorialStart !== undefined)
				) {
					this.setState({
						isClipTrimmerOpen: true,
						selectedPiece: piece,
					})
				} else {
					RundownViewEventBus.emit(RundownViewEvents.SELECT_PIECE, {
						piece,
					})
				}
			}
		}

		componentWillUnmount() {
			this._cleanUp()
			document.body.classList.remove('dark', 'vertical-overflow-only')
			window.removeEventListener('beforeunload', this.onBeforeUnload)

			documentTitle.set(null)

			const themeColor = document.head.querySelector('meta[name="theme-color"]')
			if (themeColor) {
				themeColor.setAttribute('content', themeColor.getAttribute('data-content') || '#ffffff')
			}

			if (this._hideNotificationsAfterMount) {
				Meteor.clearTimeout(this._hideNotificationsAfterMount)
			}
			NotificationCenter.isConcentrationMode = false

			RundownViewEventBus.off(RundownViewEvents.GO_TO_LIVE_SEGMENT, this.onGoToLiveSegment)
			RundownViewEventBus.off(RundownViewEvents.GO_TO_TOP, this.onGoToTop)
		}

		onBeforeUnload = (e: any) => {
			const { t } = this.props

			e.preventDefault()
			e.returnValue = t('This rundown is now active. Are you sure you want to exit this screen?')

			return t('This rundown is now active. Are you sure you want to exit this screen?')
		}

		onRewindSegments = () => {
			RundownViewEventBus.emit(RundownViewEvents.REWIND_SEGMENTS)
		}

		onTimeScaleChange = (timeScaleVal) => {
			if (Number.isFinite(timeScaleVal) && timeScaleVal > 0) {
				this.setState({
					timeScale: timeScaleVal,
				})
			}
		}

		onSegmentScroll = () => {
			if (this.state.followLiveSegments && this.props.playlist && this.props.playlist.activationId) {
				this.setState({
					followLiveSegments: false,
				})
			}
		}

		onWheelScrollInner = _.debounce(() => {
			if (this.state.followLiveSegments && this.props.playlist && this.props.playlist.activationId) {
				const liveSegmentComponent = document.querySelector('.segment-timeline.live')
				if (liveSegmentComponent) {
					const offsetPosition = liveSegmentComponent.getBoundingClientRect()
					// if it's closer to the top edge than the headerHeight
					const segmentComponentTooHigh = offsetPosition.top < getHeaderHeight()
					// or if it's closer to the bottom edge than very close to the top
					const segmentComponentTooLow =
						offsetPosition.bottom < window.innerHeight - getHeaderHeight() - 20 - (offsetPosition.height * 3) / 2
					if (segmentComponentTooHigh || segmentComponentTooLow) {
						this.setState({
							followLiveSegments: false,
						})
					}
				}
			}
		}, 250)

		onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
			if (e.deltaX === 0 && e.deltaY !== 0 && !e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
				this.onWheelScrollInner()
			}
		}

		onGoToTop = () => {
			scrollToPosition(0).catch((error) => {
				if (!error.toString().match(/another scroll/)) console.warn(error)
			})

			window.requestIdleCallback(
				() => {
					this.setState({
						followLiveSegments: true,
					})
				},
				{ timeout: 1000 }
			)
		}

		onGoToLiveSegment = () => {
			if (
				this.props.playlist &&
				this.props.playlist.activationId &&
				!this.props.playlist.currentPartInstanceId &&
				this.props.playlist.nextPartInstanceId
			) {
				this.setState({
					followLiveSegments: true,
				})
				scrollToPartInstance(this.props.playlist.nextPartInstanceId, true).catch((error) => {
					if (!error.toString().match(/another scroll/)) console.warn(error)
				})
				setTimeout(() => {
					this.setState({
						followLiveSegments: true,
					})
					RundownViewEventBus.emit(RundownViewEvents.REWIND_SEGMENTS)
				}, 2000)
			} else if (this.props.playlist && this.props.playlist.activationId && this.props.playlist.currentPartInstanceId) {
				this.setState({
					followLiveSegments: true,
				})
				scrollToPartInstance(this.props.playlist.currentPartInstanceId, true).catch((error) => {
					if (!error.toString().match(/another scroll/)) console.warn(error)
				})
				setTimeout(() => {
					this.setState({
						followLiveSegments: true,
					})
					RundownViewEventBus.emit(RundownViewEvents.REWIND_SEGMENTS)
				}, 2000)
			} else {
				this.setState({
					followLiveSegments: true,
				})
			}
		}

		onActivate = () => {
			this.onGoToLiveSegment()
		}

		onContextMenu = (contextMenuContext: IContextMenuContext) => {
			this.setState({
				contextMenuContext,
			})
		}

		onSetNext = (part: Part | undefined, e: any, offset?: number, take?: boolean) => {
			const { t } = this.props
			if (this.state.studioMode && part && part._id && this.props.playlist) {
				const playlistId = this.props.playlist._id
				doUserAction(
					t,
					e,
					UserAction.SET_NEXT,
					(e) => MeteorCall.userAction.setNext(e, playlistId, part._id, offset),
					(err) => {
						this.setState({
							manualSetAsNext: true,
						})
						if (!err && take && this.props.playlist) {
							const playlistId = this.props.playlist._id
							const currentPartInstanceId = this.props.playlist.currentPartInstanceId
							doUserAction(t, e, UserAction.TAKE, (e) =>
								MeteorCall.userAction.take(e, playlistId, currentPartInstanceId)
							)
						}
					}
				)
			}
		}
		onSetNextSegment = (segmentId: SegmentId | null, e: any) => {
			const { t } = this.props
			if (this.state.studioMode && (segmentId || segmentId === null) && this.props.playlist) {
				const playlistId = this.props.playlist._id
				doUserAction(
					t,
					e,
					UserAction.SET_NEXT,
					(e) => MeteorCall.userAction.setNextSegment(e, playlistId, segmentId),
					(err) => {
						if (err) console.error(err)
						this.setState({
							manualSetAsNext: true,
						})
					}
				)
			}
		}

		onPieceDoubleClick = (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => {
			const { t } = this.props
			if (
				this.state.studioMode &&
				item &&
				item.instance &&
				this.props.playlist &&
				this.props.playlist.currentPartInstanceId
			) {
				const idToCopy = item.instance.isTemporary ? item.instance.piece._id : item.instance._id
				const playlistId = this.props.playlist._id
				const currentPartInstanceId = this.props.playlist.currentPartInstanceId
				doUserAction(t, e, UserAction.TAKE_PIECE, (e) =>
					MeteorCall.userAction.pieceTakeNow(e, playlistId, currentPartInstanceId, idToCopy)
				)
			}
		}

		onRONotificationClick = (e: RONotificationEvent) => {
			if (e.sourceLocator) {
				let segmentId = e.sourceLocator.segmentId

				if (!segmentId) {
					if (e.sourceLocator.partId) {
						const part = Parts.findOne(e.sourceLocator.partId)
						if (part) {
							segmentId = part.segmentId
						}
					}
				}
				if (segmentId) {
					scrollToSegment(segmentId)
						.then(() => {
							RundownViewEventBus.emit(RundownViewEvents.HIGHLIGHT, e.sourceLocator)
						})
						.catch((error) => {
							if (!error.toString().match(/another scroll/)) console.warn(error)
						})
				}
			}
		}
		onHeaderNoteClick = (segmentId: SegmentId, level: NoteSeverity) => {
			NotificationCenter.snoozeAll()
			const isOpen = this.state.isNotificationsCenterOpen
			this.setState({
				isNotificationsCenterOpen: level === NoteSeverity.ERROR ? NoticeLevel.CRITICAL : NoticeLevel.WARNING,
			})
			setTimeout(
				function () {
					NotificationCenter.highlightSource(
						segmentId,
						level === NoteSeverity.ERROR ? NoticeLevel.CRITICAL : NoticeLevel.WARNING
					)
				},
				isOpen ? 1 : 1000
			)
		}

		onToggleSupportPanel = () => {
			this.setState({
				isSupportPanelOpen: !this.state.isSupportPanelOpen,
			})
		}

		onStudioRouteSetSwitch = (
			e: React.MouseEvent<HTMLElement, MouseEvent>,
			routeSetId: string,
			routeSet: StudioRouteSet,
			state: boolean
		) => {
			const { t } = this.props
			if (this.props.studio) {
				doUserAction(t, e, UserAction.SWITCH_ROUTE_SET, (e) =>
					MeteorCall.userAction.switchRouteSet(e, this.props.studio!._id, routeSetId, state)
				)
			}
		}

		onSwitchViewMode = (segmentId: SegmentId, viewMode: SegmentViewMode) => {
			if (!this.props.playlist?._id) return
			this.setState(
				(state) => ({
					segmentViewModes: {
						...state.segmentViewModes,
						[unprotectString(segmentId)]: viewMode,
					},
				}),
				() => {
					if (!this.props.playlist?._id) return
					UIStateStorage.setItem(
						`rundownView.${this.props.playlist._id}`,
						`segmentViewModes`,
						this.state.segmentViewModes
					)
				}
			)
		}

		renderSegmentComponent(
			segment: DBSegment,
			rundownAndSegments: MatchedSegment,
			rundownPlaylist: RundownPlaylist,
			studio: DBStudio,
			showStyleBase: DBShowStyleBase,
			isLastSegment: boolean,
			isFollowingOnAirSegment: boolean,
			ownCurrentPartInstance: PartInstance | undefined,
			ownNextPartInstance: PartInstance | undefined,
			segmentIdsBeforeSegment: Set<SegmentId>,
			rundownIdsBefore: RundownId[]
		) {
			const userSegmentDisplaymode = this.state.segmentViewModes[unprotectString(segment._id)] as
				| SegmentViewMode
				| undefined
			const displayMode = userSegmentDisplaymode ?? segment.displayAs ?? DEFAULT_SEGMENT_VIEW_MODE

			return displayMode === SegmentViewMode.Storyboard ? (
				<SegmentStoryboardContainer
					id={SEGMENT_TIMELINE_ELEMENT_ID + segment._id}
					studio={studio}
					showStyleBase={showStyleBase}
					followLiveSegments={this.state.followLiveSegments}
					rundownViewLayout={this.state.rundownViewLayout}
					rundownId={rundownAndSegments.rundown._id}
					segmentId={segment._id}
					playlist={rundownPlaylist}
					rundown={rundownAndSegments.rundown}
					timeScale={this.state.timeScale}
					onContextMenu={this.onContextMenu}
					onSegmentScroll={this.onSegmentScroll}
					segmentsIdsBefore={segmentIdsBeforeSegment}
					rundownIdsBefore={rundownIdsBefore}
					rundownsToShowstyles={this.props.rundownsToShowstyles}
					isLastSegment={isLastSegment}
					onPieceClick={this.onSelectPiece}
					onPieceDoubleClick={this.onPieceDoubleClick}
					onHeaderNoteClick={this.onHeaderNoteClick}
					onSwitchViewMode={(viewMode) => this.onSwitchViewMode(segment._id, viewMode)}
					ownCurrentPartInstance={ownCurrentPartInstance}
					ownNextPartInstance={ownNextPartInstance}
					isFollowingOnAirSegment={isFollowingOnAirSegment}
					countdownToSegmentRequireLayers={this.state.rundownViewLayout?.countdownToSegmentRequireLayers}
					fixedSegmentDuration={this.state.rundownViewLayout?.fixedSegmentDuration}
				/>
			) : (
				<SegmentTimelineContainer
					id={SEGMENT_TIMELINE_ELEMENT_ID + segment._id}
					studio={studio}
					showStyleBase={showStyleBase}
					followLiveSegments={this.state.followLiveSegments}
					rundownViewLayout={this.state.rundownViewLayout}
					rundownId={rundownAndSegments.rundown._id}
					segmentId={segment._id}
					playlist={rundownPlaylist}
					rundown={rundownAndSegments.rundown}
					timeScale={this.state.timeScale}
					onContextMenu={this.onContextMenu}
					onSegmentScroll={this.onSegmentScroll}
					segmentsIdsBefore={segmentIdsBeforeSegment}
					rundownIdsBefore={rundownIdsBefore}
					rundownsToShowstyles={this.props.rundownsToShowstyles}
					isLastSegment={isLastSegment}
					onPieceClick={this.onSelectPiece}
					onPieceDoubleClick={this.onPieceDoubleClick}
					onHeaderNoteClick={this.onHeaderNoteClick}
					onSwitchViewMode={(viewMode) => this.onSwitchViewMode(segment._id, viewMode)}
					ownCurrentPartInstance={ownCurrentPartInstance}
					ownNextPartInstance={ownNextPartInstance}
					isFollowingOnAirSegment={isFollowingOnAirSegment}
					countdownToSegmentRequireLayers={this.state.rundownViewLayout?.countdownToSegmentRequireLayers}
					fixedSegmentDuration={this.state.rundownViewLayout?.fixedSegmentDuration}
				/>
			)
		}

		renderSegments() {
			if (!this.props.matchedSegments) {
				return null
			}

			let globalIndex = 0
			const rundowns = this.props.matchedSegments.map((m) => m.rundown._id)
			return this.props.matchedSegments.map((rundownAndSegments, rundownIndex, rundownArray) => {
				let currentSegmentIndex = -1
				const rundownIdsBefore = rundowns.slice(0, rundownIndex)
				return (
					<React.Fragment key={unprotectString(rundownAndSegments.rundown._id)}>
						{this.props.matchedSegments.length > 1 && !this.state.rundownViewLayout?.hideRundownDivider && (
							<RundownDividerHeader
								key={`rundown_${rundownAndSegments.rundown._id}`}
								rundown={rundownAndSegments.rundown}
								playlist={this.props.playlist!}
							/>
						)}
						{rundownAndSegments.segments.map((segment, segmentIndex, segmentArray) => {
							if (this.props.studio && this.props.playlist && this.props.showStyleBase) {
								const ownCurrentPartInstance =
									// feed the currentPartInstance into the SegmentTimelineContainer component, if the currentPartInstance
									// is a part of the segment
									(this.props.currentPartInstance && this.props.currentPartInstance.segmentId === segment._id) ||
									// or the nextPartInstance is a part of this segment, and the currentPartInstance is autoNext
									(this.props.nextPartInstance &&
										this.props.nextPartInstance.segmentId === segment._id &&
										this.props.currentPartInstance &&
										this.props.currentPartInstance.part.autoNext)
										? this.props.currentPartInstance
										: undefined
								const ownNextPartInstance =
									this.props.nextPartInstance && this.props.nextPartInstance.segmentId === segment._id
										? this.props.nextPartInstance
										: undefined

								if (ownCurrentPartInstance) {
									currentSegmentIndex = segmentIndex
								}

								const isFollowingOnAirSegment = segmentIndex === currentSegmentIndex + 1

								const isLastSegment =
									rundownIndex === rundownArray.length - 1 && segmentIndex === segmentArray.length - 1

								return (
									<ErrorBoundary key={unprotectString(segment._id)}>
										<VirtualElement
											id={SEGMENT_TIMELINE_ELEMENT_ID + segment._id}
											margin={'100% 0px 100% 0px'}
											initialShow={globalIndex++ < window.innerHeight / 260}
											placeholderHeight={260}
											placeholderClassName="placeholder-shimmer-element segment-timeline-placeholder"
											width="auto"
										>
											{this.renderSegmentComponent(
												segment,
												rundownAndSegments,
												this.props.playlist,
												this.props.studio,
												this.props.showStyleBase,
												isLastSegment,
												isFollowingOnAirSegment,
												ownCurrentPartInstance,
												ownNextPartInstance,
												rundownAndSegments.segmentIdsBeforeEachSegment[segmentIndex],
												rundownIdsBefore
											)}
										</VirtualElement>
									</ErrorBoundary>
								)
							}
						})}
						{this.state.rundownViewLayout?.showBreaksAsSegments &&
							rundownAndSegments.rundown.endOfRundownIsShowBreak && (
								<BreakSegment breakTime={PlaylistTiming.getExpectedEnd(rundownAndSegments.rundown.timing)} />
							)}
					</React.Fragment>
				)
			})
		}

		renderSegmentsList() {
			if (!this.props.playlist || !this.props.rundowns.length) {
				return (
					<div className="mod">
						<Spinner />
					</div>
				)
			}

			return (
				<React.Fragment>
					{this.props.playlist?.loop && (
						<PlaylistLoopingHeader position="start" multiRundown={this.props.matchedSegments.length > 1} />
					)}
					<div className="segment-timeline-container" role="main" aria-labelledby="rundown-playlist-name">
						{this.renderSegments()}
					</div>
					{this.props.playlist?.loop && (
						<PlaylistLoopingHeader
							position="end"
							multiRundown={this.props.matchedSegments.length > 1}
							showCountdowns={!!(this.props.playlist.activationId && this.props.playlist.currentPartInstanceId)}
						/>
					)}
				</React.Fragment>
			)
		}

		onChangeBottomMargin = (newBottomMargin: string) => {
			this.setState({
				bottomMargin: newBottomMargin,
			})
		}

		onContextMenuTop = (e: React.MouseEvent<HTMLDivElement>): boolean => {
			if (!getAllowDeveloper()) {
				e.preventDefault()
				e.stopPropagation()
			}
			return false
		}

		onToggleNotifications = (e: React.MouseEvent<HTMLElement>, filter: NoticeLevel) => {
			if (!this.state.isNotificationsCenterOpen === true) {
				NotificationCenter.highlightSource(undefined, NoticeLevel.CRITICAL)
			}

			NotificationCenter.isOpen = !(this.state.isNotificationsCenterOpen === filter)

			this.setState({
				isNotificationsCenterOpen: this.state.isNotificationsCenterOpen === filter ? undefined : filter,
			})
		}

		onToggleHotkeys = () => {
			if (!this.state.isInspectorShelfExpanded) {
				this.setState({
					isInspectorShelfExpanded: true,
				})
				RundownViewEventBus.emit(RundownViewEvents.SWITCH_SHELF_TAB, {
					tab: ShelfTabs.SYSTEM_HOTKEYS,
				})
			} else {
				this.setState({
					isInspectorShelfExpanded: false,
				})
			}

			this.setState({
				wasShelfResizedByUser: true,
			})
		}

		onRestartPlayout = (e: React.MouseEvent<HTMLButtonElement>) => {
			const { t, studio } = this.props

			if (!studio) {
				return
			}

			const attachedPlayoutGateways = PeripheralDevices.find({
				studioId: studio._id,
				connected: true,
				type: PeripheralDeviceType.PLAYOUT,
			}).fetch()
			if (attachedPlayoutGateways.length === 0) {
				NotificationCenter.push(
					new Notification(
						undefined,
						NoticeLevel.CRITICAL,
						t(
							'There are no Playout\xa0Gateways connected and attached to this studio. Please contact the system administrator to start the Playout Gateway.'
						),
						'RundownView'
					)
				)
				return
			}

			e.persist()

			const restartPlayoutGateway = () => {
				attachedPlayoutGateways.forEach((item) => {
					PeripheralDevicesAPI.restartDevice(item, e)
						.then(() => {
							NotificationCenter.push(
								new Notification(
									undefined,
									NoticeLevel.NOTIFICATION,
									t('Playout\xa0Gateway "{{playoutDeviceName}}" is now restarting.', { playoutDeviceName: item.name }),
									'RundownView'
								)
							)
						})
						.catch(() => {
							NotificationCenter.push(
								new Notification(
									undefined,
									NoticeLevel.CRITICAL,
									t('Could not restart Playout\xa0Gateway "{{playoutDeviceName}}".', { playoutDeviceName: item.name }),
									'RundownView'
								)
							)
						})
				})
			}

			doModalDialog({
				title: t('Restart Playout'),
				message: t('Do you want to restart the Playout\xa0Gateway?'),
				onAccept: restartPlayoutGateway,
			})
		}

		onRestartCasparCG = (e: React.MouseEvent<HTMLButtonElement>, device: PeripheralDevice) => {
			const { t } = this.props

			e.persist()

			doModalDialog({
				title: t('Restart CasparCG Server'),
				message: t('Do you want to restart CasparCG Server "{{device}}"?', { device: device.name }),
				onAccept: () => {
					callPeripheralDeviceFunction(e, device._id, CASPARCG_RESTART_TIME, 'restartCasparCG')
						.then(() => {
							NotificationCenter.push(
								new Notification(
									undefined,
									NoticeLevel.NOTIFICATION,
									t('CasparCG on device "{{deviceName}}" restarting...', { deviceName: device.name }),
									'SystemStatus'
								)
							)
						})
						.catch((err) => {
							NotificationCenter.push(
								new Notification(
									undefined,
									NoticeLevel.WARNING,
									t('Failed to restart CasparCG on device: "{{deviceName}}": {{errorMessage}}', {
										deviceName: device.name,
										errorMessage: err + '',
									}),
									'SystemStatus'
								)
							)
						})
				},
			})
		}

		onTakeRundownSnapshot = (e: React.MouseEvent<HTMLButtonElement>) => {
			const { t } = this.props
			if (!this.props.playlist) {
				return
			}

			const playlistId = this.props.playlist._id
			const doneMessage = t('A snapshot of the current Running\xa0Order has been created for troubleshooting.')
			doUserAction(
				t,
				e,
				UserAction.CREATE_SNAPSHOT_FOR_DEBUG,
				(e) => MeteorCall.userAction.storeRundownSnapshot(e, playlistId, 'User requested log at' + getCurrentTime()),
				() => {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.NOTIFICATION,
							doneMessage,
							'userAction',
							undefined,
							false,
							undefined,
							undefined,
							5000
						)
					)
					return false
				},
				doneMessage
			)
		}

		onShelfChangeExpanded = (value: boolean) => {
			this.setState({
				isInspectorShelfExpanded: value,
				wasShelfResizedByUser: true,
			})
		}

		onTake = (e: any) => {
			RundownViewEventBus.emit(RundownViewEvents.TAKE, {
				context: e,
			})
		}

		getStyle() {
			return {
				marginBottom: this.state.bottomMargin,
			}
		}

		isHotkeyAllowed(e: KeyboardEvent): boolean {
			if (isModalShowing() || isEventInInputField(e)) {
				return false
			}
			return true
		}

		defaultHotkeys(t: i18next.TFunction) {
			return [
				// Register additional hotkeys or legend entries
				{
					key: 'Escape',
					label: t('Cancel currently pressed hotkey'),
				},
				{
					key: 'F11',
					label: t('Change to fullscreen mode'),
				},
			]
		}

		renderRundownView(
			studio: DBStudio,
			playlist: RundownPlaylist,
			showStyleBase: ShowStyleBase,
			showStyleVariant: ShowStyleVariant
		) {
			const { t } = this.props

			const selectedPiece = this.state.selectedPiece
			const selectedPieceRundown: Rundown | undefined =
				(selectedPiece &&
					RundownUtils.isPieceInstance(selectedPiece) &&
					this.props.rundowns.find((r) => r._id === selectedPiece?.instance.rundownId)) ||
				undefined

			return (
				<RundownTimingProvider playlist={playlist} defaultDuration={Settings.defaultDisplayDuration}>
					<StudioContext.Provider value={studio}>
						<div
							className={ClassNames('rundown-view', {
								'notification-center-open': this.state.isNotificationsCenterOpen !== undefined,
								'rundown-view--studio-mode': this.state.studioMode,
							})}
							style={this.getStyle()}
							onWheelCapture={this.onWheel}
							onContextMenu={this.onContextMenuTop}
						>
							{this.renderSegmentsList()}
							<ErrorBoundary>
								{this.props.matchedSegments && this.props.matchedSegments.length > 0 && (
									<AfterBroadcastForm playlist={playlist} />
								)}
							</ErrorBoundary>
							<ErrorBoundary>
								<RundownHeader
									playlist={playlist}
									studio={studio}
									rundownIds={this.props.rundowns.map((r) => r._id)}
									firstRundown={this.props.rundowns[0]}
									onActivate={this.onActivate}
									studioMode={this.state.studioMode}
									inActiveRundownView={this.props.inActiveRundownView}
									currentRundown={this.state.currentRundown || this.props.rundowns[0]}
									layout={this.state.rundownHeaderLayout}
									showStyleBase={showStyleBase}
									showStyleVariant={showStyleVariant}
								/>
							</ErrorBoundary>
							<ErrorBoundary>
								{this.state.studioMode && !Settings.disableBlurBorder && (
									<KeyboardFocusIndicator>
										<div
											className={ClassNames('rundown-view__focus-lost-frame', {
												'rundown-view__focus-lost-frame--reduce-animation': Meteor.isDevelopment,
											})}
										></div>
									</KeyboardFocusIndicator>
								)}
							</ErrorBoundary>
							<ErrorBoundary>
								<RundownRightHandControls
									isFollowingOnAir={this.state.followLiveSegments}
									onFollowOnAir={this.onGoToLiveSegment}
									onRewindSegments={this.onRewindSegments}
									isNotificationCenterOpen={this.state.isNotificationsCenterOpen}
									onToggleNotifications={this.onToggleNotifications}
									isSupportPanelOpen={this.state.isSupportPanelOpen}
									onToggleSupportPanel={this.onToggleSupportPanel}
									isStudioMode={this.state.studioMode}
									onTake={this.onTake}
									studioRouteSets={studio.routeSets}
									studioRouteSetExclusivityGroups={studio.routeSetExclusivityGroups}
									onStudioRouteSetSwitch={this.onStudioRouteSetSwitch}
								/>
							</ErrorBoundary>
							<ErrorBoundary>
								<SorensenContext.Consumer>
									{(sorensen) =>
										sorensen && (
											<TriggersHandler
												rundownPlaylistId={this.props.rundownPlaylistId}
												showStyleBaseId={showStyleBase._id}
												currentRundownId={this.props.currentRundown?._id || null}
												currentPartId={this.props.currentPartInstance?.part._id || null}
												nextPartId={this.props.nextPartInstance?.part._id || null}
												currentSegmentPartIds={this.props.currentSegmentPartIds}
												nextSegmentPartIds={this.props.nextSegmentPartIds}
												sorensen={sorensen}
												global={this.isHotkeyAllowed}
											/>
										)
									}
								</SorensenContext.Consumer>
							</ErrorBoundary>
							<ErrorBoundary>
								<VelocityReact.VelocityTransitionGroup
									enter={{
										animation: {
											translateX: ['0%', '100%'],
										},
										easing: 'ease-out',
										duration: 300,
									}}
									leave={{
										animation: {
											translateX: ['100%', '0%'],
										},
										easing: 'ease-in',
										duration: 500,
									}}
								>
									{this.state.isNotificationsCenterOpen && (
										<NotificationCenterPanel filter={this.state.isNotificationsCenterOpen} />
									)}
								</VelocityReact.VelocityTransitionGroup>
								<VelocityReact.VelocityTransitionGroup
									enter={{
										animation: {
											translateX: ['0%', '100%'],
										},
										easing: 'ease-out',
										duration: 300,
									}}
									leave={{
										animation: {
											translateX: ['100%', '0%'],
										},
										easing: 'ease-in',
										duration: 500,
									}}
								>
									{this.state.isSupportPanelOpen && (
										<SupportPopUp>
											<hr />
											<button className="btn btn-secondary" onClick={this.onToggleHotkeys}>
												{t('Show Hotkeys')}
											</button>
											<hr />
											<button className="btn btn-secondary" onClick={this.onTakeRundownSnapshot}>
												{t('Take a Snapshot')}
											</button>
											<hr />
											{this.state.studioMode && (
												<>
													<button className="btn btn-secondary" onClick={this.onRestartPlayout}>
														{t('Restart Playout')}
													</button>
													<hr />
												</>
											)}
											{this.state.studioMode &&
												this.props.casparCGPlayoutDevices &&
												this.props.casparCGPlayoutDevices.map((i) => (
													<React.Fragment key={unprotectString(i._id)}>
														<button className="btn btn-secondary" onClick={(e) => this.onRestartCasparCG(e, i)}>
															{t('Restart {{device}}', { device: i.name })}
														</button>
														<hr />
													</React.Fragment>
												))}
										</SupportPopUp>
									)}
								</VelocityReact.VelocityTransitionGroup>
							</ErrorBoundary>
							<ErrorBoundary>
								{this.state.studioMode && (
									<Prompt
										when={!!playlist.activationId}
										message={t('This rundown is now active. Are you sure you want to exit this screen?')}
									/>
								)}
							</ErrorBoundary>
							<ErrorBoundary>
								<NoraPreviewRenderer />
							</ErrorBoundary>
							<ErrorBoundary>
								<SegmentContextMenu
									contextMenuContext={this.state.contextMenuContext}
									playlist={playlist}
									onSetNext={this.onSetNext}
									onSetNextSegment={this.onSetNextSegment}
									studioMode={this.state.studioMode}
									enablePlayFromAnywhere={!!studio.settings.enablePlayFromAnywhere}
								/>
							</ErrorBoundary>
							<ErrorBoundary>
								{this.state.isClipTrimmerOpen &&
									this.state.selectedPiece &&
									RundownUtils.isPieceInstance(this.state.selectedPiece) &&
									(selectedPieceRundown === undefined ? (
										<ModalDialog
											onAccept={() => this.setState({ selectedPiece: undefined })}
											title={t('Rundown not found')}
											acceptText={t('Close')}
										>
											{t('Rundown for piece "{{pieceLabel}}" could not be found.', {
												pieceLabel: this.state.selectedPiece.instance.piece.name,
											})}
										</ModalDialog>
									) : (
										<ClipTrimDialog
											studio={studio}
											playlistId={playlist._id}
											rundown={selectedPieceRundown}
											selectedPiece={this.state.selectedPiece.instance.piece}
											onClose={() => this.setState({ isClipTrimmerOpen: false })}
										/>
									))}
							</ErrorBoundary>
							<ErrorBoundary>
								<PointerLockCursor />
							</ErrorBoundary>
							<ErrorBoundary>
								<Shelf
									buckets={this.props.buckets}
									isExpanded={
										this.state.isInspectorShelfExpanded ||
										(!this.state.wasShelfResizedByUser && this.state.shelfLayout?.openByDefault)
									}
									onChangeExpanded={this.onShelfChangeExpanded}
									hotkeys={this.defaultHotkeys(t)}
									playlist={this.props.playlist}
									showStyleBase={this.props.showStyleBase}
									showStyleVariant={this.props.showStyleVariant}
									studioMode={this.state.studioMode}
									onChangeBottomMargin={this.onChangeBottomMargin}
									rundownLayout={this.state.shelfLayout}
									shelfDisplayOptions={this.props.shelfDisplayOptions}
									bucketDisplayFilter={this.props.bucketDisplayFilter}
									studio={this.props.studio}
								/>
							</ErrorBoundary>
							<ErrorBoundary>
								{this.props.playlist && this.props.studio && this.props.showStyleBase && (
									<RundownNotifier
										playlistId={this.props.playlist._id}
										studio={this.props.studio}
										showStyleBase={this.props.showStyleBase}
									/>
								)}
							</ErrorBoundary>
						</div>
						{
							// USE IN CASE OF DEBUGGING EMERGENCY
							/* getDeveloperMode() && <div id='debug-console' className='debug-console' style={{
							background: 'rgba(255,255,255,0.7)',
							color: '#000',
							position: 'fixed',
							top: '0',
							right: '0',
							zIndex: 10000,
							pointerEvents: 'none'
						}}>
						</div> */
						}
					</StudioContext.Provider>
				</RundownTimingProvider>
			)
		}

		renderDetachedShelf() {
			return (
				<RundownTimingProvider playlist={this.props.playlist} defaultDuration={Settings.defaultDisplayDuration}>
					<ErrorBoundary>
						<NoraPreviewRenderer />
					</ErrorBoundary>
					<ErrorBoundary>
						<Shelf
							buckets={this.props.buckets}
							isExpanded={this.state.isInspectorShelfExpanded}
							onChangeExpanded={this.onShelfChangeExpanded}
							hotkeys={this.defaultHotkeys(this.props.t)}
							playlist={this.props.playlist}
							showStyleBase={this.props.showStyleBase}
							showStyleVariant={this.props.showStyleVariant}
							studioMode={this.state.studioMode}
							onChangeBottomMargin={this.onChangeBottomMargin}
							rundownLayout={this.state.shelfLayout}
							studio={this.props.studio}
							fullViewport={true}
							shelfDisplayOptions={this.props.shelfDisplayOptions}
							bucketDisplayFilter={this.props.bucketDisplayFilter}
						/>
					</ErrorBoundary>
				</RundownTimingProvider>
			)
		}

		renderDataMissing() {
			const { t } = this.props

			return (
				<div className="rundown-view rundown-view--unpublished">
					<div className="rundown-view__label">
						<p>
							{!this.props.playlist
								? t('This rundown has been unpublished from Sofie.')
								: !this.props.studio
								? t('Error: The studio of this Rundown was not found.')
								: !this.props.rundowns.length
								? t('This playlist is empty')
								: !this.props.showStyleBase || !this.props.showStyleVariant
								? t('Error: The ShowStyle of this Rundown was not found.')
								: t('Unknown error')}
						</p>
						<p>
							<Route
								render={({ history }) => (
									<button
										className="btn btn-primary"
										onClick={() => {
											history.push('/rundowns')
										}}
									>
										{t('Return to list')}
									</button>
								)}
							/>
						</p>
					</div>
				</div>
			)
		}

		render() {
			if (!this.state.subsReady) {
				return (
					<div className="rundown-view rundown-view--loading">
						<Spinner />
					</div>
				)
			}

			if (
				this.props.playlist &&
				this.props.studio &&
				this.props.showStyleBase &&
				this.props.showStyleVariant &&
				!this.props.onlyShelf
			) {
				return this.renderRundownView(
					this.props.studio,
					this.props.playlist,
					this.props.showStyleBase,
					this.props.showStyleVariant
				)
			} else if (
				this.props.playlist &&
				this.props.studio &&
				this.props.showStyleBase &&
				this.props.showStyleVariant &&
				this.props.onlyShelf
			) {
				return this.renderDetachedShelf()
			} else {
				return this.renderDataMissing()
			}
		}
	}
)

function handleRundownPlaylistReloadResponse(t: i18next.TFunction, result: ReloadRundownPlaylistResponse): boolean {
	const rundownsInNeedOfHandling = result.rundownsResponses.filter(
		(r) => r.response === TriggerReloadDataResponse.MISSING
	)
	const firstRundownId = _.first(rundownsInNeedOfHandling)?.rundownId
	let allRundownsAffected = false

	if (firstRundownId) {
		const firstRundown = Rundowns.findOne(firstRundownId)
		const playlist = RundownPlaylists.findOne(firstRundown?.playlistId)
		const allRundownIds = playlist ? RundownPlaylistCollectionUtil.getRundownUnorderedIDs(playlist) : []
		if (
			allRundownIds.length > 0 &&
			_.difference(
				allRundownIds,
				rundownsInNeedOfHandling.map((r) => r.rundownId)
			).length === 0
		) {
			allRundownsAffected = true
		}
	}

	const actionsTaken: RundownReloadResponseUserAction[] = []
	function onActionTaken(action: RundownReloadResponseUserAction): void {
		actionsTaken.push(action)
		if (actionsTaken.length === rundownsInNeedOfHandling.length) {
			// the user has taken action on all of the missing rundowns
			if (allRundownsAffected && actionsTaken.filter((actionTaken) => actionTaken !== 'removed').length === 0) {
				// all rundowns in the playlist were affected and all of them were removed
				// we redirect to the Lobby
				window.location.assign('/')
			}
		}
	}

	const handled = rundownsInNeedOfHandling.map((r) =>
		handleRundownReloadResponse(t, r.rundownId, r.response, onActionTaken)
	)
	return handled.reduce((previousValue, value) => previousValue || value, false)
}

type RundownReloadResponseUserAction = 'removed' | 'unsynced' | 'error'

export function handleRundownReloadResponse(
	t: i18next.TFunction,
	rundownId: RundownId,
	result: TriggerReloadDataResponse,
	clb?: (action: RundownReloadResponseUserAction) => void
): boolean {
	let hasDoneSomething = false

	if (result === TriggerReloadDataResponse.MISSING) {
		const rundown = Rundowns.findOne(rundownId)
		const playlist = RundownPlaylists.findOne(rundown?.playlistId)

		hasDoneSomething = true
		const notification = new Notification(
			undefined,
			NoticeLevel.CRITICAL,
			t(
				'Rundown {{rundownName}} in Playlist {{playlistName}} is missing in the data from {{nrcsName}}. You can either leave it in Sofie and mark it as Unsynced or remove the rundown from Sofie. What do you want to do?',
				{
					nrcsName: rundown?.externalNRCSName || 'NRCS',
					rundownName: rundown?.name || t('(Unknown rundown)'),
					playlistName: playlist?.name || t('(Unknown playlist)'),
				}
			),
			'userAction',
			undefined,
			true,
			[
				// actions:
				{
					label: t('Leave Unsynced'),
					type: 'default',
					disabled: !getAllowStudio(),
					action: () => {
						doUserAction(
							t,
							'Missing rundown action',
							UserAction.UNSYNC_RUNDOWN,
							(e) => MeteorCall.userAction.unsyncRundown(e, rundownId),
							(err) => {
								if (!err) {
									notificationHandle.stop()
									clb && clb('unsynced')
								} else {
									clb && clb('error')
								}
							}
						)
					},
				},
				{
					label: t('Remove'),
					type: 'default',
					action: () => {
						doModalDialog({
							title: t('Remove rundown'),
							message: t(
								'Do you really want to remove just the rundown "{{rundownName}}" in the playlist {{playlistName}} from Sofie? This cannot be undone!',
								{
									rundownName: rundown?.name || 'N/A',
									playlistName: playlist?.name || 'N/A',
								}
							),
							onAccept: () => {
								// nothing
								doUserAction(
									t,
									'Missing rundown action',
									UserAction.REMOVE_RUNDOWN,
									(e) => MeteorCall.userAction.removeRundown(e, rundownId),
									(err) => {
										if (!err) {
											notificationHandle.stop()
											clb && clb('removed')
										} else {
											clb && clb('error')
										}
									}
								)
							},
						})
					},
				},
			]
		)
		const notificationHandle = NotificationCenter.push(notification)

		if (rundown) {
			// This allows the semi-modal dialog above to be closed automatically, once the rundown stops existing
			// for whatever reason
			const comp = Tracker.autorun(() => {
				const rundown = Rundowns.findOne(rundownId, {
					fields: {
						_id: 1,
						orphaned: 1,
					},
				})
				// we should hide the message
				if (!rundown || !rundown.orphaned) {
					notificationHandle.stop()
				}
			})
			notification.on('dropped', () => {
				// clean up the reactive computation above when the notification is closed. Will be also executed by
				// the notificationHandle.stop() above, so the Tracker.autorun will clean up after itself as well.
				comp.stop()
			})
		}
	}
	return hasDoneSomething
}
