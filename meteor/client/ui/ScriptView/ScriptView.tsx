import * as React from 'react'
import * as VelocityReact from 'velocity-react'

import { parse as queryStringParse } from 'query-string'
import * as _ from 'underscore'

import { TSR, SourceLayerType, IOutputLayer } from 'tv-automation-sofie-blueprints-integration'

import { withTracker, Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'

import { RundownPlaylist, RundownPlaylists, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { Rundown, Rundowns, RundownId } from '../../../lib/collections/Rundowns'
import { Segment, SegmentId } from '../../../lib/collections/Segments'
import { Studio, Studios } from '../../../lib/collections/Studios'

import { PieceUi } from '../SegmentTimeline/SegmentTimelineContainer'

import { unprotectString, protectString } from '../../../lib/lib'

import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { getAllowStudio, getAllowDeveloper } from '../../lib/localStorage'

import { ShowStyleBases, ShowStyleBase } from '../../../lib/collections/ShowStyleBases'

import { PeripheralDevices, PeripheralDevice } from '../../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'

import { PubSub } from '../../../lib/api/pubsub'
import {
	RundownLayout,
	RundownLayouts,
	RundownLayoutBase,
	RundownLayoutId,
} from '../../../lib/collections/RundownLayouts'

import {
	scrollToPart,
	scrollToPosition,
	scrollToSegment,
	maintainFocusOnPartInstance,
	scrollToPartInstance,
} from '../../lib/viewPort'

import { Buckets, Bucket } from '../../../lib/collections/Buckets'
import { Settings } from '../../../lib/Settings'
import { AdLibPieceUi } from '../Shelf/AdLibPanel'
import { documentTitle } from '../../lib/documentTitle'

import { ScriptViewSegment } from './ScriptViewSegment'
import { Part, Parts } from '../../../lib/collections/Parts'
import { Piece } from '../../../lib/collections/Pieces'
import { RundownHeader, IContextMenuContext } from '../RundownView'
import { ErrorBoundary } from '../../lib/ErrorBoundary'
import { RundownTimingProvider } from '../RundownView/RundownTiming'
import { RundownFullscreenControls } from '../RundownView/RundownFullscreenControls'
import {
	RONotificationEvent,
	onRONotificationClick as rundownNotificationHandler,
	RundownNotifier,
	reloadRundownPlaylistClick,
} from '../RundownView/RundownNotifier'
import { doUserAction, UserAction } from '../../lib/userAction'
import { MeteorCall } from '../../../lib/api/methods'
import { NotificationCenter, NoticeLevel, Notification } from '../../lib/notifications/notifications'
import { PeripheralDevicesAPI, callPeripheralDeviceFunction } from '../../lib/clientAPI'
import { doModalDialog } from '../../lib/ModalDialog'
import { SupportPopUp } from '../SupportPopUp'
import { Prompt } from 'react-router-dom'
import { t } from 'i18next'
import { NotificationCenterPanel } from '../../lib/notifications/NotificationCenterPanel'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { SegmentContextMenu } from '../SegmentTimeline/SegmentContextMenu'

export interface LayerGroups<T, P> {
	primaryGroup: T
	overlayGroup: T
	audioGroup: T
	otherGroup: T
	adlibGroup: P
}

export interface OutputGroups<T, P> {
	[key: string]: LayerGroups<T, P>
}

interface ScriptViewProps {
	match?: {
		params: {
			rundownId: RundownPlaylistId
		}
	}
	rundownId?: RundownId
	inActiveRundownView?: boolean
	onlyShelf?: boolean
}
interface ScriptViewState {
	timeScale: number
	studioMode: boolean
	bottomMargin: string
	followLiveSegments: boolean
	manualSetAsNext: boolean
	subsReady: boolean
	isNotificationsCenterOpen: boolean
	isSupportPanelOpen: boolean
	isInspectorShelfExpanded: boolean
	isClipTrimmerOpen: boolean
	selectedPiece: AdLibPieceUi | PieceUi | undefined
	rundownLayout: RundownLayout | undefined
	contextMenuContext: IContextMenuContext | null
}

interface ScriptViewTrackedProps {
	rundownId: RundownId
	rundown: Rundown | undefined
	rundownPlaylistId?: RundownPlaylistId
	playlist?: RundownPlaylist
	segments: Segment[]
	parts: Part[]
	pieces: Piece[]
	adlibs: AdLibPiece[]
	studio?: Studio
	showStyleBase?: ShowStyleBase
	rundownLayouts?: Array<RundownLayoutBase>
	buckets: Bucket[]
	casparCGPlayoutDevices?: PeripheralDevice[]
	rundownLayoutId?: RundownLayoutId
	activeLayerGroups: OutputGroups<boolean, boolean>
}

export const ScriptView = translateWithTracker<ScriptViewProps, ScriptViewState, ScriptViewTrackedProps>(
	(props: ScriptViewProps) => {
		let rundownId
		if (props.match && props.match.params.rundownId) {
			rundownId = decodeURIComponent(unprotectString(props.match.params.rundownId))
		} else if (props.rundownId) {
			rundownId = props.rundownId
		}

		const rundown = Rundowns.findOne(rundownId)
		let playlist: RundownPlaylist | undefined
		let segments: Segment[] = []
		let parts: Part[] = []
		let pieces: Piece[] = []
		let adlibs: AdLibPiece[] = []

		let showStyleBase: ShowStyleBase | undefined
		let activeLayerGroups: OutputGroups<boolean, boolean> = {}

		if (rundown) {
			showStyleBase = ShowStyleBases.findOne(rundown.showStyleBaseId)
			playlist = RundownPlaylists.findOne(rundown.playlistId)
		}

		let studio: Studio | undefined
		if (playlist) {
			studio = Studios.findOne({ _id: playlist.studioId })
			segments = playlist.getSegments({
				isHidden: {
					$ne: true,
				},
			})

			if (segments.length > 0) {
				parts = segments.map((seg) => seg.getParts()).reduce((acc, val) => acc.concat(val), [])
			}

			if (parts.length > 0) {
				pieces = parts.map((part) => part.getAllPieces()).reduce((acc, val) => acc.concat(val), [])
				adlibs = parts.map((part) => part.getAdLibPieces()).reduce((acc, val) => acc.concat(val), [])

				if (pieces.length > 0 && showStyleBase && studio) {
					showStyleBase.outputLayers.map((output) => {
						const layerGroups: LayerGroups<boolean, boolean> = {
							primaryGroup: false,
							overlayGroup: false,
							audioGroup: false,
							otherGroup: false,
							adlibGroup: false,
						}

						let setLayerGroupActive = (type: SourceLayerType) => {
							switch (type) {
								case SourceLayerType.SCRIPT:
									break

								case SourceLayerType.TRANSITION:
								case SourceLayerType.VT:
								case SourceLayerType.CAMERA:
								case SourceLayerType.REMOTE:
								case SourceLayerType.SPLITS:
								case SourceLayerType.LIVE_SPEAK:
									layerGroups.primaryGroup = true
									break

								case SourceLayerType.GRAPHICS:
								case SourceLayerType.LOWER_THIRD:
									layerGroups.overlayGroup = true
									break

								case SourceLayerType.AUDIO:
								case SourceLayerType.MIC:
									layerGroups.audioGroup = true
									break

								default:
									layerGroups.otherGroup = true
									break
							}
						}

						const layerIdtoLayerType = (type: string) => {
							if (showStyleBase) {
								const layer = showStyleBase.sourceLayers.find((sl) => sl._id == type)

								if (layer) {
									return layer.type
								}
							}

							return SourceLayerType.UNKNOWN
						}

						pieces
							.filter((piece) => piece.outputLayerId == output._id)
							.map((piece) => {
								setLayerGroupActive(layerIdtoLayerType(piece.sourceLayerId))
							})

						if (adlibs.filter((adlib) => adlib.outputLayerId == output._id).length > 0) {
							layerGroups.adlibGroup = true
						}

						if (Object.keys(layerGroups).filter((key) => layerGroups[key]).length > 0) {
							activeLayerGroups[output.name] = layerGroups
						}
					})
				}
			}
		}

		const params = queryStringParse(location.search)

		// let rundownDurations = calculateDurations(rundown, parts)
		return {
			rundownId,
			rundownPlaylistId: rundown ? rundown.playlistId : protectString(''),
			rundown,
			segments,
			parts,
			pieces,
			adlibs,
			playlist,
			studio: studio,
			showStyleBase,
			rundownLayouts: rundown ? RundownLayouts.find({ showStyleBaseId: rundown.showStyleBaseId }).fetch() : undefined,
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
						type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
						subType: TSR.DeviceType.CASPARCG,
					}).fetch()) ||
				undefined,
			rundownLayoutId: protectString((params['layout'] as string) || ''),
			activeLayerGroups,
		}
	}
)(
	class ScriptView extends MeteorReactComponent<Translated<ScriptViewProps> & ScriptViewTrackedProps, ScriptViewState> {
		constructor(props: ScriptViewProps & ScriptViewTrackedProps) {
			super(props)

			this.state = {
				timeScale: Settings.defaultTimeScale,
				studioMode: getAllowStudio(),
				bottomMargin: '',
				followLiveSegments: true,
				manualSetAsNext: false,
				subsReady: false,
				isNotificationsCenterOpen: false,
				isSupportPanelOpen: false,
				isInspectorShelfExpanded: false,
				isClipTrimmerOpen: false,
				selectedPiece: undefined,
				rundownLayout: undefined,
				contextMenuContext: null,
			}
		}

		componentDidMount() {
			const rundownId = this.props.rundownId

			this.subscribe(PubSub.parts, {
				rundownId: rundownId,
			})

			this.subscribe(PubSub.pieces, {
				rundownId: rundownId,
			})

			this.subscribe(PubSub.adLibPieces, {
				rundownId: rundownId,
			})

			this.autorun(() => {
				this.subscribe(PubSub.rundowns, {
					_id: rundownId,
				})

				let rundown = Rundowns.findOne(rundownId)

				let playlist: RundownPlaylist | undefined
				if (rundown) {
					this.subscribe(PubSub.rundownPlaylists, {
						_id: rundown.playlistId,
					})

					playlist = RundownPlaylists.findOne(rundown.playlistId)

					this.subscribe(PubSub.showStyleBases, {
						_id: rundown.showStyleBaseId,
					})

					this.subscribe(PubSub.rundownLayouts, {
						showStyleBaseId: rundown.showStyleBaseId,
					})

					this.subscribe(PubSub.segments, {
						rundownId: rundown._id,
					})
					this.subscribe(PubSub.adLibPieces, {
						rundownId: rundown._id,
					})
					this.subscribe(PubSub.rundownBaselineAdLibPieces, {
						rundownId: rundown._id,
					})
				}

				if (playlist) {
					this.subscribe(PubSub.studios, {
						_id: playlist.studioId,
					})
					this.subscribe(PubSub.buckets, {
						studioId: playlist.studioId,
					})
				}
			})

			this.autorun(() => {
				let subsReady = this.subscriptionsReady()
				if (subsReady !== this.state.subsReady) {
					this.setState({
						subsReady: subsReady,
					})
				}
			})

			document.body.classList.add('dark', 'vertical-overflow-only')

			document.body.classList.add('dark', 'vertical-overflow-only')

			rundownNotificationHandler.set(this.onRONotificationClick)

			if (this.props.playlist) {
				documentTitle.set(this.props.playlist.name)
			}

			const themeColor = document.head.querySelector('meta[name="theme-color"]')
			if (themeColor) {
				themeColor.setAttribute('data-content', themeColor.getAttribute('content') || '')
				themeColor.setAttribute('content', '#000000')
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

		shouldComponentUpdate(nextProps: ScriptViewProps & ScriptViewTrackedProps, nextState: ScriptViewState) {
			let result = !_.isMatch(this.props, nextProps) || !_.isMatch(this.state, nextState)
			return result
		}

		componentWillUnmount() {
			this._cleanUp()
			document.body.classList.remove('dark', 'vertical-overflow-only')

			documentTitle.set(null)

			const themeColor = document.head.querySelector('meta[name="theme-color"]')
			if (themeColor) {
				themeColor.setAttribute('content', themeColor.getAttribute('data-content') || '#ffffff')
			}
		}

		renderHeaders() {
			const headersToText = {
				primaryGroup: 'Primaries',
				overlayGroup: 'Overlays',
				audioGroup: 'Audio',
				otherGroup: 'Others',
				adlibGroup: 'AdLibs',
			}

			const headersWithPieces = this.props.activeLayerGroups

			return Object.keys(this.props.activeLayerGroups).map((header) => {
				return Object.keys(this.props.activeLayerGroups[header])
					.filter((layergroup) => this.props.activeLayerGroups[header][layergroup])
					.map((layerGroup, index, arr) => {
						return (
							<div
								key={header + '__' + layerGroup}
								className={
									'segment-script-view__layergroup__layer ' + (arr.length - 1 == index ? 'last_layer_in_group' : '')
								}>
								{index == 0 && (
									<div className="segment-script-view__output__label">
										<h3>{header}</h3>
									</div>
								)}
								<h4>{headersToText[layerGroup]}</h4>
							</div>
						)
					})
			})
		}

		onTake = (e: any) => {
			const { t } = this.props
			if (this.state.studioMode && this.props.playlist) {
				const playlistId = this.props.playlist._id
				doUserAction(t, e, UserAction.TAKE, (e) => MeteorCall.userAction.take(e, playlistId))
			}
		}

		onToggleSupportPanel = () => {
			this.setState({
				isSupportPanelOpen: !this.state.isSupportPanelOpen,
			})
		}

		onToggleNotifications = () => {
			if (!this.state.isNotificationsCenterOpen === true) {
				NotificationCenter.highlightSource(undefined, NoticeLevel.CRITICAL)
			}

			NotificationCenter.isOpen = !this.state.isNotificationsCenterOpen

			this.setState({
				isNotificationsCenterOpen: !this.state.isNotificationsCenterOpen,
			})
		}

		onContextMenu = (contextMenuContext: IContextMenuContext) => {
			this.setState({
				contextMenuContext,
			})
		}

		onSetNext = (part: Part, e: any, offset?: number, take?: boolean) => {
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
							doUserAction(t, e, UserAction.TAKE, (e) => MeteorCall.userAction.take(e, playlistId))
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
					(err, res) => {
						if (err) console.error(err)
						this.setState({
							manualSetAsNext: true,
						})
					}
				)
			}
		}

		onResyncSegment = (segmentId: SegmentId, e: any) => {
			const { t } = this.props
			if (this.state.studioMode && this.props.rundownPlaylistId) {
				doUserAction(t, e, UserAction.RESYNC_SEGMENT, (e) => MeteorCall.userAction.resyncSegment(e, segmentId))
			}
		}

		onContextMenuTop = (e: React.MouseEvent<HTMLDivElement>): boolean => {
			if (!getAllowDeveloper()) {
				e.preventDefault()
				e.stopPropagation()
			}
			return false
		}

		render() {
			return (
				<div className="script-view">
					<ErrorBoundary>
						{this.props.playlist && this.props.studio && this.props.rundown && (
							<RundownTimingProvider playlist={this.props.playlist}>
								<div onContextMenu={this.onContextMenuTop}>
									<ErrorBoundary>
										<SegmentContextMenu
											contextMenuContext={this.state.contextMenuContext}
											playlist={this.props.playlist}
											onSetNext={this.onSetNext}
											onSetNextSegment={this.onSetNextSegment}
											onResyncSegment={this.onResyncSegment}
											studioMode={this.state.studioMode}
										/>
									</ErrorBoundary>
									<ErrorBoundary>
										<RundownFullscreenControls
											isFollowingOnAir={this.state.followLiveSegments}
											// onFollowOnAir={this.onGoToLiveSegment}
											// onRewindSegments={this.onRewindSegments}
											isNotificationCenterOpen={this.state.isNotificationsCenterOpen}
											onToggleNotifications={this.onToggleNotifications}
											isSupportPanelOpen={this.state.isSupportPanelOpen}
											onToggleSupportPanel={this.onToggleSupportPanel}
											isStudioMode={this.state.studioMode}
											onTake={this.onTake}
										/>
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
											}}>
											{this.state.isNotificationsCenterOpen && <NotificationCenterPanel />}
										</VelocityReact.VelocityTransitionGroup>
									</ErrorBoundary>
									<ErrorBoundary>
										{this.state.studioMode && (
											<Prompt
												when={this.props.playlist.active || false}
												message={t('This rundown is now active. Are you sure you want to exit this screen?')}
											/>
										)}
									</ErrorBoundary>
									<ErrorBoundary>
										<RundownHeader
											playlist={this.props.playlist}
											studio={this.props.studio}
											rundownIds={[this.props.rundown._id]}
											//onActivate={this.onActivate}
											studioMode={this.state.studioMode}
											//onRegisterHotkeys={this.onRegisterHotkeys}
											inActiveRundownView={this.props.inActiveRundownView}
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
							</RundownTimingProvider>
						)}
					</ErrorBoundary>
					<div>
						<div className="segment-script-view__sticky">
							<div className="segment-script-view__output">
								<div className="segment-script-view__layergroup">
									<div className="segment-script-view__layergroup__script">
										<h4>Script</h4>
									</div>
									{this.props.showStyleBase && this.renderHeaders()}
								</div>
							</div>
						</div>
						{this.props.segments.map(
							(item, index, arr) =>
								this.props.studio &&
								this.props.showStyleBase &&
								this.props.playlist && (
									<ScriptViewSegment
										key={item._id + ''}
										id={'Segment__' + item._id + '' + item._rank}
										segmentId={item._id}
										studio={this.props.studio && this.props.studio}
										showStyleBase={this.props.showStyleBase}
										playlist={this.props.playlist}
										pieces={this.props.pieces}
										adlibs={this.props.adlibs}
										activeLayerGroups={this.props.activeLayerGroups}
										isLastSegment={index === arr.length - 1}
										onContextMenu={this.onContextMenu}
										isQueuedSegment={this.props.playlist.nextSegmentId === item._id}
									/>
								)
						)}
					</div>
				</div>
			)
		}
	}
)
