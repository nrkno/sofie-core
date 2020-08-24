import * as React from 'react'
import * as _ from 'underscore'
import * as Velocity from 'velocity-animate'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { withTranslation } from 'react-i18next'
import { Rundown, RundownId } from '../../../lib/collections/Rundowns'
import { Segment } from '../../../lib/collections/Segments'
import { Part, PartId } from '../../../lib/collections/Parts'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { AdLibListItem } from './AdLibListItem'
import ClassNames from 'classnames'
import { mousetrapHelper } from '../../lib/mousetrapHelper'

import { Spinner } from '../../lib/Spinner'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownViewKbdShortcuts } from '../RundownView'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { IOutputLayer, ISourceLayer, PieceLifespan } from 'tv-automation-sofie-blueprints-integration'
import { PubSub, meteorSubscribe } from '../../../lib/api/pubsub'
import { doUserAction, UserAction } from '../../lib/userAction'
import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications'
import { RundownLayoutFilter, DashboardLayoutFilter, PieceDisplayStyle } from '../../../lib/collections/RundownLayouts'
import { RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { Random } from 'meteor/random'
import { literal, unprotectString, getCurrentTime } from '../../../lib/lib'
import { RundownAPI } from '../../../lib/api/rundown'
import {
	IAdLibPanelProps,
	IAdLibPanelTrackedProps,
	fetchAndFilter,
	AdLibPieceUi,
	matchFilter,
	AdLibPanelToolbar,
} from './AdLibPanel'
import { DashboardPieceButton } from './DashboardPieceButton'
import { ensureHasTrailingSlash } from '../../lib/lib'
import { Studio } from '../../../lib/collections/Studios'
import { Piece, Pieces, PieceId } from '../../../lib/collections/Pieces'
import { invalidateAt } from '../../lib/invalidatingTime'
import { PieceInstances, PieceInstance, PieceInstanceId } from '../../../lib/collections/PieceInstances'
import { MeteorCall } from '../../../lib/api/methods'
import { RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { PartInstanceId } from '../../../lib/collections/PartInstances'
import { registerHotkey, RegisteredHotkeys, HotkeyAssignmentType } from '../../lib/hotkeyRegistry'
import { pieceSetInOutPoints } from '../../../server/api/userActions'

interface IState {
	outputLayers: {
		[key: string]: IOutputLayer
	}
	sourceLayers: {
		[key: string]: ISourceLayer
	}
	searchFilter: string | undefined
	selectedAdLib?: AdLibPieceUi
}

const BUTTON_GRID_WIDTH = 1
const BUTTON_GRID_HEIGHT = 0.61803

export interface IDashboardPanelProps {
	searchFilter?: string | undefined
	mediaPreviewUrl?: string
	shouldQueue: boolean
	hotkeyGroup: string
}

export interface IDashboardPanelTrackedProps {
	studio?: Studio
	unfinishedAdLibIds: PieceId[]
	unfinishedTags: string[]
	nextAdLibIds: PieceId[]
	nextTags: string[]
}

interface DashboardPositionableElement {
	x: number
	y: number
	width: number
	height: number
	scale?: number
}

export function dashboardElementPosition(
	el: DashboardPositionableElement
): React.CSSProperties & { '--dashboard-panel-scale': number | undefined } {
	return {
		width:
			el.width >= 0
				? `calc((${el.width} * var(--dashboard-button-grid-width)) + var(--dashboard-panel-margin-width))`
				: undefined,
		height:
			el.height >= 0
				? `calc((${el.height} * var(--dashboard-button-grid-height)) + var(--dashboard-panel-margin-height))`
				: undefined,
		left:
			el.x >= 0
				? `calc(${el.x} * var(--dashboard-button-grid-width))`
				: el.width < 0
				? `calc(${-1 * el.width - 1} * var(--dashboard-button-grid-width))`
				: undefined,
		top:
			el.y >= 0
				? `calc(${el.y} * var(--dashboard-button-grid-height))`
				: el.height < 0
				? `calc(${-1 * el.height - 1} * var(--dashboard-button-grid-height))`
				: undefined,
		right:
			el.x < 0
				? `calc(${-1 * el.x - 1} * var(--dashboard-button-grid-width))`
				: el.width < 0
				? `calc(${-1 * el.width - 1} * var(--dashboard-button-grid-width))`
				: undefined,
		bottom:
			el.y < 0
				? `calc(${-1 * el.y - 1} * var(--dashboard-button-grid-height))`
				: el.height < 0
				? `calc(${-1 * el.height - 1} * var(--dashboard-button-grid-height))`
				: undefined,
		'--dashboard-panel-scale': el.scale || undefined,
	}
}

export class DashboardPanelInner extends MeteorReactComponent<
	Translated<IAdLibPanelProps & IDashboardPanelProps & IAdLibPanelTrackedProps & IDashboardPanelTrackedProps>,
	IState
> {
	usedHotkeys: Array<string> = []

	constructor(
		props: Translated<IAdLibPanelProps & IDashboardPanelProps & IAdLibPanelTrackedProps & IDashboardPanelTrackedProps>
	) {
		super(props)

		this.state = {
			outputLayers: {},
			sourceLayers: {},
			searchFilter: undefined,
		}
	}

	static getDerivedStateFromProps(props: IAdLibPanelProps, state) {
		let tOLayers: {
			[key: string]: IOutputLayer
		} = {}
		let tSLayers: {
			[key: string]: ISourceLayer
		} = {}

		if (props.showStyleBase && props.showStyleBase.outputLayers && props.showStyleBase.sourceLayers) {
			props.showStyleBase.outputLayers.forEach((outputLayer) => {
				tOLayers[outputLayer._id] = outputLayer
			})
			props.showStyleBase.sourceLayers.forEach((sourceLayer) => {
				tSLayers[sourceLayer._id] = sourceLayer
			})

			return _.extend(state, {
				outputLayers: tOLayers,
				sourceLayers: tSLayers,
			})
		} else {
			return state
		}
	}

	componentDidMount() {
		this.subscribe(PubSub.rundowns, {
			playlistId: this.props.playlist._id,
		})
		this.subscribe(PubSub.studios, {
			_id: this.props.playlist.studioId,
		})
		this.autorun(() => {
			const rundowns = this.props.playlist.getRundowns()
			const rundownIds = rundowns.map((i) => i._id)
			if (rundowns.length > 0) {
				this.subscribe(PubSub.segments, {
					rundownId: {
						$in: rundownIds,
					},
				})
				this.subscribe(PubSub.parts, {
					rundownId: {
						$in: rundownIds,
					},
				})
				this.subscribe(PubSub.partInstances, {
					rundownId: {
						$in: rundownIds,
					},
					reset: {
						$ne: true,
					},
				})
				this.subscribe(PubSub.adLibPieces, {
					rundownId: {
						$in: rundownIds,
					},
				})
				this.subscribe(PubSub.rundownBaselineAdLibPieces, {
					rundownId: {
						$in: rundownIds,
					},
				})
				this.subscribe(PubSub.showStyleBases, {
					_id: rundowns[0].showStyleBaseId,
				})
				this.subscribe(PubSub.pieces, {
					rundownId: {
						$in: rundownIds,
					},
					startedPlayback: {
						$exists: true,
					},
					adLibSourceId: {
						$exists: true,
					},
					$or: [
						{
							stoppedPlayback: {
								$eq: 0,
							},
						},
						{
							stoppedPlayback: {
								$exists: false,
							},
						},
					],
				})
			}
		})

		this.refreshKeyboardHotkeys()
	}

	componentDidUpdate(
		prevProps: IAdLibPanelProps & IDashboardPanelProps & IAdLibPanelTrackedProps & IDashboardPanelTrackedProps
	) {
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keyup', this.props.hotkeyGroup)
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keydown', this.props.hotkeyGroup)
		this.usedHotkeys.length = 0

		// Unregister hotkeys if group name has changed
		if (prevProps.hotkeyGroup !== this.props.hotkeyGroup) {
			RegisteredHotkeys.remove({
				tag: prevProps.hotkeyGroup,
			})
		}

		this.refreshKeyboardHotkeys()
	}

	componentWillUnmount() {
		this._cleanUp()
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keyup', this.props.hotkeyGroup)
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keydown', this.props.hotkeyGroup)

		RegisteredHotkeys.remove({
			tag: this.props.hotkeyGroup,
		})

		this.usedHotkeys.length = 0
	}

	isAdLibOnAir(adLib: AdLibPieceUi) {
		return isAdLibOnAir(this.props.unfinishedAdLibIds, this.props.unfinishedTags, adLib)
	}

	isAdLibNext(adLib: AdLibPieceUi) {
		return isAdLibNext(this.props.nextAdLibIds, this.props.unfinishedTags, this.props.nextTags, adLib)
	}

	refreshKeyboardHotkeys() {
		if (!this.props.studioMode) return

		// Unregister even when "registerHotkeys" is false, in the case that it has just been toggled off.
		RegisteredHotkeys.remove({
			tag: this.props.hotkeyGroup,
		})

		if (!this.props.registerHotkeys) return

		const { t } = this.props

		let preventDefault = (e) => {
			e.preventDefault()
		}

		if (this.props.liveSegment && this.props.liveSegment.pieces) {
			this.props.liveSegment.pieces.forEach((item) => {
				if (item.hotkey) {
					mousetrapHelper.bind(item.hotkey, preventDefault, 'keydown', this.props.hotkeyGroup)
					mousetrapHelper.bind(
						item.hotkey,
						(e: ExtendedKeyboardEvent) => {
							preventDefault(e)
							this.onToggleAdLib(item, false, e)
						},
						'keyup',
						this.props.hotkeyGroup
					)
					this.usedHotkeys.push(item.hotkey)

					registerHotkey(
						item.hotkey,
						item.name,
						HotkeyAssignmentType.ADLIB,
						this.props.sourceLayerLookup[item.sourceLayerId],
						item.toBeQueued || false,
						this.onToggleAdLib,
						[item, false],
						this.props.hotkeyGroup
					)

					const sourceLayer = this.props.sourceLayerLookup[item.sourceLayerId]
					if (sourceLayer && sourceLayer.isQueueable) {
						const queueHotkey = [RundownViewKbdShortcuts.ADLIB_QUEUE_MODIFIER, item.hotkey].join('+')
						mousetrapHelper.bind(queueHotkey, preventDefault, 'keydown', this.props.hotkeyGroup)
						mousetrapHelper.bind(
							queueHotkey,
							(e: ExtendedKeyboardEvent) => {
								preventDefault(e)
								this.onToggleAdLib(item, true, e)
							},
							'keyup',
							this.props.hotkeyGroup
						)
						this.usedHotkeys.push(queueHotkey)
					}
				}
			})
		}

		if (this.props.rundownBaselineAdLibs) {
			this.props.rundownBaselineAdLibs.forEach((item) => {
				if (item.hotkey) {
					mousetrapHelper.bind(item.hotkey, preventDefault, 'keydown', this.props.hotkeyGroup)
					mousetrapHelper.bind(
						item.hotkey,
						(e: ExtendedKeyboardEvent) => {
							preventDefault(e)
							this.onToggleAdLib(item, false, e)
						},
						'keyup',
						this.props.hotkeyGroup
					)
					this.usedHotkeys.push(item.hotkey, this.props.hotkeyGroup)

					registerHotkey(
						item.hotkey,
						item.name,
						HotkeyAssignmentType.ADLIB,
						this.props.sourceLayerLookup[item.sourceLayerId],
						item.toBeQueued || false,
						this.onToggleAdLib,
						[item, false],
						this.props.hotkeyGroup
					)

					const sourceLayer = this.props.sourceLayerLookup[item.sourceLayerId]
					if (sourceLayer && sourceLayer.isQueueable) {
						const queueHotkey = [RundownViewKbdShortcuts.ADLIB_QUEUE_MODIFIER, item.hotkey].join('+')
						mousetrapHelper.bind(queueHotkey, preventDefault, 'keydown', this.props.hotkeyGroup)
						mousetrapHelper.bind(
							queueHotkey,
							(e: ExtendedKeyboardEvent) => {
								preventDefault(e)
								this.onToggleAdLib(item, true, e)
							},
							'keyup',
							this.props.hotkeyGroup
						)
						this.usedHotkeys.push(queueHotkey)
					}
				}
			})
		}

		if (this.props.sourceLayerLookup) {
			const clearKeyboardHotkeySourceLayers: { [hotkey: string]: ISourceLayer[] } = {}

			_.each(this.props.sourceLayerLookup, (sourceLayer) => {
				if (sourceLayer.clearKeyboardHotkey) {
					sourceLayer.clearKeyboardHotkey.split(',').forEach((hotkey) => {
						if (!clearKeyboardHotkeySourceLayers[hotkey]) clearKeyboardHotkeySourceLayers[hotkey] = []
						clearKeyboardHotkeySourceLayers[hotkey].push(sourceLayer)
					})
				}

				if (sourceLayer.isSticky && sourceLayer.activateStickyKeyboardHotkey) {
					sourceLayer.activateStickyKeyboardHotkey.split(',').forEach((element) => {
						mousetrapHelper.bind(element, preventDefault, 'keydown', this.props.hotkeyGroup)
						mousetrapHelper.bind(
							element,
							(e: ExtendedKeyboardEvent) => {
								preventDefault(e)
								this.onToggleSticky(sourceLayer._id, e)
							},
							'keyup',
							this.props.hotkeyGroup
						)
						this.usedHotkeys.push(element)

						registerHotkey(
							element,
							t('Recall last {{layerNames}}', { layerNames: sourceLayer.name }),
							HotkeyAssignmentType.ADLIB,
							sourceLayer,
							false,
							this.onToggleSticky,
							[sourceLayer._id],
							this.props.hotkeyGroup
						)
					})
				}
			})

			_.each(clearKeyboardHotkeySourceLayers, (sourceLayers, hotkey) => {
				mousetrapHelper.bind(hotkey, preventDefault, 'keydown', this.props.hotkeyGroup)
				mousetrapHelper.bind(
					hotkey,
					(e: ExtendedKeyboardEvent) => {
						preventDefault(e)
						this.onClearAllSourceLayers(sourceLayers, e)
					},
					'keyup',
					this.props.hotkeyGroup
				)
				this.usedHotkeys.push(hotkey)

				registerHotkey(
					hotkey,
					t('Clear {{layerNames}}', {
						layerNames: _.unique(sourceLayers.map((sourceLayer) => sourceLayer.name)).join(', '),
					}),
					HotkeyAssignmentType.GLOBAL_ADLIB,
					undefined,
					false,
					this.onClearAllSourceLayers,
					[sourceLayers],
					this.props.hotkeyGroup
				)
			})
		}
	}

	onToggleAdLib = (adlibPiece: AdLibPieceUi, queue: boolean, e: any) => {
		const { t } = this.props

		queue = queue || this.props.shouldQueue

		if (adlibPiece.invalid) {
			NotificationCenter.push(
				new Notification(
					t('Invalid AdLib'),
					NoticeLevel.WARNING,
					t('Cannot play this AdLib because it is marked as Invalid'),
					'toggleAdLib'
				)
			)
			return
		}
		if (adlibPiece.floated) {
			NotificationCenter.push(
				new Notification(
					t('Floated AdLib'),
					NoticeLevel.WARNING,
					t('Cannot play this AdLib because it is marked as Floated'),
					'toggleAdLib'
				)
			)
			return
		}

		let sourceLayer = this.props.sourceLayerLookup && this.props.sourceLayerLookup[adlibPiece.sourceLayerId]

		if (queue && sourceLayer && sourceLayer.isQueueable) {
			console.log(`Item "${adlibPiece._id}" is on sourceLayer "${adlibPiece.sourceLayerId}" that is not queueable.`)
			return
		}
		if (this.props.playlist && this.props.playlist.currentPartInstanceId) {
			const currentPartInstanceId = this.props.playlist.currentPartInstanceId
			if (!this.isAdLibOnAir(adlibPiece) || !(sourceLayer && sourceLayer.clearKeyboardHotkey)) {
				if (adlibPiece.isAction && adlibPiece.adlibAction) {
					const action = adlibPiece.adlibAction
					doUserAction(t, e, adlibPiece.isGlobal ? UserAction.START_GLOBAL_ADLIB : UserAction.START_ADLIB, (e) =>
						MeteorCall.userAction.executeAction(e, this.props.playlist._id, action.actionId, action.userData)
					)
				} else if (!adlibPiece.isGlobal && !adlibPiece.isAction) {
					doUserAction(t, e, UserAction.START_ADLIB, (e) =>
						MeteorCall.userAction.segmentAdLibPieceStart(
							e,
							this.props.playlist._id,
							currentPartInstanceId,
							adlibPiece._id,
							queue || false
						)
					)
				} else if (adlibPiece.isGlobal && !adlibPiece.isSticky) {
					doUserAction(t, e, UserAction.START_GLOBAL_ADLIB, (e) =>
						MeteorCall.userAction.baselineAdLibPieceStart(
							e,
							this.props.playlist._id,
							currentPartInstanceId,
							adlibPiece._id,
							queue || false
						)
					)
				} else if (adlibPiece.isSticky) {
					this.onToggleSticky(adlibPiece.sourceLayerId, e)
				}
			} else {
				if (sourceLayer && sourceLayer.clearKeyboardHotkey) {
					this.onClearAllSourceLayers([sourceLayer], e)
				}
			}
		}
	}

	onToggleSticky = (sourceLayerId: string, e: any) => {
		if (this.props.playlist && this.props.playlist.currentPartInstanceId && this.props.playlist.active) {
			const { t } = this.props
			doUserAction(t, e, UserAction.START_STICKY_PIECE, (e) =>
				MeteorCall.userAction.sourceLayerStickyPieceStart(e, this.props.playlist._id, sourceLayerId)
			)
		}
	}

	onClearAllSourceLayers = (sourceLayers: ISourceLayer[], e: any) => {
		// console.log(sourceLayer)
		const { t } = this.props
		if (this.props.playlist && this.props.playlist.currentPartInstanceId) {
			const playlistId = this.props.playlist._id
			const currentPartInstanceId = this.props.playlist.currentPartInstanceId
			doUserAction(t, e, UserAction.CLEAR_SOURCELAYER, (e) =>
				MeteorCall.userAction.sourceLayerOnPartStop(
					e,
					playlistId,
					currentPartInstanceId,
					_.map(sourceLayers, (sl) => sl._id)
				)
			)
		}
	}

	onFilterChange = (filter: string) => {
		this.setState({
			searchFilter: filter,
		})
	}

	onIn = (e: any) => {
		const { t } = this.props
		if (this.state.selectedAdLib) {
			const piece = this.state.selectedAdLib
			let sourceLayer = this.props.sourceLayerLookup && this.props.sourceLayerLookup[piece.sourceLayerId]
			if (this.props.playlist && this.props.playlist.currentPartInstanceId) {
				if (!this.isAdLibOnAir(piece) || !(sourceLayer && sourceLayer.clearKeyboardHotkey)) {
					if (!piece.isGlobal) {
						doUserAction(t, e, UserAction.START_ADLIB, (e) =>
							MeteorCall.userAction.segmentAdLibPieceStart(
								e,
								this.props.playlist._id,
								this.props.playlist.currentPartInstanceId as PartInstanceId,
								piece._id,
								false
							)
						)
					} else if (piece.isGlobal && !piece.isSticky) {
						doUserAction(t, e, UserAction.START_GLOBAL_ADLIB, (e) =>
							MeteorCall.userAction.baselineAdLibPieceStart(
								e,
								this.props.playlist._id,
								this.props.playlist.currentPartInstanceId as PartInstanceId,
								piece._id,
								false
							)
						)
					} else if (piece.isSticky) {
						this.onToggleSticky(piece.sourceLayerId, e)
					}
				}
			}
		}
	}

	onOut = (e: any, outButton?: boolean) => {
		const { t } = this.props
		if (this.state.selectedAdLib) {
			const piece = this.state.selectedAdLib
			let sourceLayer = this.props.sourceLayerLookup && this.props.sourceLayerLookup[piece.sourceLayerId]
			if (sourceLayer && (sourceLayer.clearKeyboardHotkey || outButton)) {
				this.onClearAllSourceLayers([sourceLayer], e)
			}
		}
	}

	onSelectAdLib = (piece: AdLibPieceUi, queue: boolean, e: any) => {
		this.setState({
			selectedAdLib: piece,
		})
	}

	render() {
		const { t } = this.props
		if (this.props.visible && this.props.showStyleBase && this.props.filter) {
			const filter = this.props.filter as DashboardLayoutFilter
			if (!this.props.uiSegments || !this.props.playlist) {
				return <Spinner />
			} else {
				return (
					<div
						className={ClassNames('dashboard-panel', {
							'dashboard-panel--take': filter.displayTakeButtons,
						})}
						style={dashboardElementPosition(filter)}>
						<h4 className="dashboard-panel__header">{this.props.filter.name}</h4>
						{filter.enableSearch && <AdLibPanelToolbar onFilterChange={this.onFilterChange} />}
						<div
							className={ClassNames('dashboard-panel__panel', {
								'dashboard-panel__panel--horizontal': filter.overflowHorizontally,
							})}>
							{this.props.rundownBaselineAdLibs
								.concat(_.flatten(this.props.uiSegments.map((seg) => seg.pieces)))
								.filter((item) =>
									matchFilter(
										item,
										this.props.showStyleBase,
										this.props.uiSegments,
										this.props.filter,
										this.state.searchFilter
									)
								)
								.map((adLibPiece: AdLibPieceUi) => {
									return (
										<DashboardPieceButton
											key={unprotectString(adLibPiece._id)}
											adLibListItem={adLibPiece}
											layer={this.state.sourceLayers[adLibPiece.sourceLayerId]}
											outputLayer={this.state.outputLayers[adLibPiece.outputLayerId]}
											onToggleAdLib={filter.displayTakeButtons ? this.onSelectAdLib : this.onToggleAdLib}
											playlist={this.props.playlist}
											isOnAir={this.isAdLibOnAir(adLibPiece)}
											isNext={this.isAdLibNext(adLibPiece)}
											mediaPreviewUrl={
												this.props.studio
													? ensureHasTrailingSlash(this.props.studio.settings.mediaPreviewsUrl + '' || '') || ''
													: ''
											}
											widthScale={filter.buttonWidthScale}
											heightScale={filter.buttonHeightScale}
											displayStyle={filter.displayStyle}
											showThumbnailsInList={filter.showThumbnailsInList}
											isSelected={this.state.selectedAdLib && adLibPiece._id === this.state.selectedAdLib._id}>
											{adLibPiece.name}
										</DashboardPieceButton>
									)
								})}
						</div>
						{filter.displayTakeButtons && (
							<div className="dashboard-panel__buttons">
								<div
									className={ClassNames('dashboard-panel__panel__button')}
									onClick={(e) => {
										this.onIn(e)
									}}>
									<span className="dashboard-panel__panel__button__label">{t('In')}</span>
								</div>
								<div
									className={ClassNames('dashboard-panel__panel__button')}
									onClick={(e) => {
										this.onOut(e, true)
									}}>
									<span className="dashboard-panel__panel__button__label">{t('Out')}</span>
								</div>
							</div>
						)}
					</div>
				)
			}
		}
		return null
	}
}

export function getUnfinishedPieceInstancesReactive(
	currentPartInstanceId: PartInstanceId | null,
	adlib: boolean = true
) {
	let prospectivePieces: PieceInstance[] = []
	const now = getCurrentTime()
	if (currentPartInstanceId) {
		prospectivePieces = PieceInstances.find({
			'piece.startedPlayback': {
				$exists: true,
			},
			$and: [
				{
					$or: [
						{
							'piece.stoppedPlayback': {
								$eq: 0,
							},
						},
						{
							'piece.stoppedPlayback': {
								$exists: false,
							},
						},
					],
				},
				{
					'piece.definitelyEnded': {
						$exists: false,
					},
				},
				{
					$or: [
						...(adlib
							? [
									{
										'piece.adLibSourceId': {
											$exists: true,
										},
									},
							  ]
							: []),
						{
							'piece.tags': {
								$exists: true,
							},
						},
					],
				},
				{
					$or: [
						{
							'piece.userDuration': {
								$exists: false,
							},
						},
						{
							'piece.userDuration.duration': {
								$exists: false,
							},
						},
					],
				},
			],
			'piece.playoutDuration': {
				$exists: false,
			},
		}).fetch()

		let nearestEnd = Number.POSITIVE_INFINITY
		prospectivePieces = prospectivePieces.filter((pieceInstance) => {
			const piece = pieceInstance.piece
			let duration: number | undefined = piece.playoutDuration
				? piece.playoutDuration
				: piece.userDuration && typeof piece.userDuration.duration === 'number'
				? piece.userDuration.duration
				: piece.userDuration && typeof piece.userDuration.end === 'string'
				? 0 // TODO: obviously, it would be best to evaluate this, but for now we assume that userDuration of any sort is probably in the past
				: typeof piece.enable.duration === 'number'
				? piece.enable.duration
				: undefined

			if (duration !== undefined) {
				const end = piece.startedPlayback! + duration
				if (end > now) {
					nearestEnd = nearestEnd > end ? end : nearestEnd
					return true
				} else {
					return false
				}
			}
			return true
		})

		if (Number.isFinite(nearestEnd)) invalidateAt(nearestEnd)
	}

	return prospectivePieces
}

export function getNextPiecesReactive(nextPartInstanceId: PartInstanceId | null): PieceInstance[] {
	let prospectivePieceInstances: PieceInstance[] = []
	if (nextPartInstanceId) {
		prospectivePieceInstances = PieceInstances.find({
			partInstanceId: nextPartInstanceId,
			$and: [
				{
					piece: {
						$exists: true,
					},
				},
				{
					$or: [
						{
							'piece.adLibSourceId': {
								$exists: true,
							},
						},
						{
							'piece.tags': {
								$exists: true,
							},
						},
					],
				},
			],
		}).fetch()
	}

	return prospectivePieceInstances
}

export function getUnfinishedPieceInstancesGrouped(
	currentPartInstanceId: PartInstanceId | null,
	adlib: boolean = true
): Pick<IDashboardPanelTrackedProps, 'unfinishedAdLibIds' | 'unfinishedTags'> & {
	unfinishedPieceInstances: PieceInstance[]
} {
	const unfinishedPieceInstances = getUnfinishedPieceInstancesReactive(currentPartInstanceId, adlib)

	const unfinishedAdLibIds: PieceId[] = unfinishedPieceInstances
		.filter((piece) => !!piece.piece.adLibSourceId)
		.map((piece) => piece.piece.adLibSourceId!)
	const unfinishedTags: string[] = unfinishedPieceInstances
		.filter((piece) => !!piece.piece.tags)
		.map((piece) => piece.piece.tags!)
		.reduce((a, b) => a.concat(b), [])

	return {
		unfinishedAdLibIds,
		unfinishedTags,
		unfinishedPieceInstances,
	}
}

export function getNextPieceInstancesGrouped(
	nextPartInstanceId: PartInstanceId | null
): Pick<IDashboardPanelTrackedProps, 'nextAdLibIds' | 'nextTags'> & { nextPieceInstances: PieceInstance[] } {
	const nextPieceInstances = getNextPiecesReactive(nextPartInstanceId)

	const nextAdLibIds: PieceId[] = nextPieceInstances
		.filter((piece) => !!piece.piece.adLibSourceId)
		.map((piece) => piece.piece.adLibSourceId!)
	const nextTags: string[] = nextPieceInstances
		.filter((piece) => !!piece.piece.tags)
		.map((piece) => piece.piece.tags!)
		.reduce((a, b) => a.concat(b), [])

	return { nextAdLibIds, nextTags, nextPieceInstances }
}

export function isAdLibOnAir(
	unfinishedAdLibIds: IDashboardPanelTrackedProps['unfinishedAdLibIds'],
	unfinishedTags: IDashboardPanelTrackedProps['unfinishedTags'],
	adLib: AdLibPieceUi
) {
	if (
		unfinishedAdLibIds.includes(adLib._id) ||
		(adLib.onAirTags && adLib.onAirTags.every((tag) => unfinishedTags.includes(tag)))
	) {
		return true
	}
	return false
}

export function isAdLibNext(
	nextAdLibIds: IDashboardPanelTrackedProps['nextAdLibIds'],
	unfinishedTags: IDashboardPanelTrackedProps['unfinishedTags'],
	nextTags: IDashboardPanelTrackedProps['nextTags'],
	adLib: AdLibPieceUi
) {
	if (
		nextAdLibIds.includes(adLib._id) ||
		(adLib.setNextTags && adLib.setNextTags.every((tag) => unfinishedTags.includes(tag))) ||
		(adLib.setNextTags && adLib.setNextTags.every((tag) => nextTags.includes(tag)))
	) {
		return true
	}
	return false
}

export const DashboardPanel = translateWithTracker<
	Translated<IAdLibPanelProps & IDashboardPanelProps>,
	IState,
	IAdLibPanelTrackedProps & IDashboardPanelTrackedProps
>(
	(props: Translated<IAdLibPanelProps>) => {
		const { unfinishedAdLibIds, unfinishedTags } = getUnfinishedPieceInstancesGrouped(
			props.playlist.currentPartInstanceId
		)
		const { nextAdLibIds, nextTags } = getNextPieceInstancesGrouped(props.playlist.nextPartInstanceId)
		return {
			...fetchAndFilter(props),
			studio: props.playlist.getStudio(),
			unfinishedAdLibIds,
			unfinishedTags,
			nextAdLibIds,
			nextTags,
		}
	},
	(data, props: IAdLibPanelProps, nextProps: IAdLibPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(DashboardPanelInner)
