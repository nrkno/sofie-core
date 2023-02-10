import React from 'react'
import _ from 'underscore'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import ClassNames from 'classnames'

import { Spinner } from '../../lib/Spinner'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { ISourceLayer, IBlueprintActionTriggerMode } from '@sofie-automation/blueprints-integration'
import { PubSub } from '../../../lib/api/pubsub'
import { doUserAction, UserAction } from '../../lib/userAction'
import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications'
import { DashboardLayoutFilter, DashboardPanelUnit } from '../../../lib/collections/RundownLayouts'
import { unprotectString } from '../../../lib/lib'
import { IAdLibPanelProps, AdLibFetchAndFilterProps, fetchAndFilter } from './AdLibPanel'
import { AdLibPanelToolbar } from './AdLibPanelToolbar'
import { matchFilter } from './AdLibListView'
import { DashboardPieceButton } from './DashboardPieceButton'
import {
	ensureHasTrailingSlash,
	contextMenuHoldToDisplayTime,
	UserAgentPointer,
	USER_AGENT_POINTER_PROPERTY,
} from '../../lib/lib'
import { MeteorCall } from '../../../lib/api/methods'
import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import { setShelfContextMenuContext, ContextType } from './ShelfContextMenu'
import { RundownUtils } from '../../lib/rundown'
import { RundownPlaylistCollectionUtil } from '../../../lib/collections/RundownPlaylists'
import {
	AdLibPieceUi,
	getNextPieceInstancesGrouped,
	getUnfinishedPieceInstancesGrouped,
	isAdLibDisplayedAsOnAir,
	isAdLibNext,
	isAdLibOnAir,
} from '../../lib/shelf'
import { OutputLayers, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { UIStudio } from '../../../lib/api/studios'
import { UIStudios } from '../Collections'
import { Meteor } from 'meteor/meteor'
import { PieceId } from '@sofie-automation/corelib/dist/dataModel/Ids'

interface IState {
	outputLayers: OutputLayers
	sourceLayers: SourceLayers
	searchFilter: string | undefined
	selectedAdLib?: AdLibPieceUi
	singleClickMode: boolean
}

export interface IDashboardPanelProps {
	searchFilter?: string | undefined
	mediaPreviewUrl?: string
	shouldQueue: boolean
}

export interface IDashboardPanelTrackedProps {
	studio: UIStudio | undefined
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
	xUnit?: DashboardPanelUnit
	yUnit?: DashboardPanelUnit
	widthUnit?: DashboardPanelUnit
	heightUnit?: DashboardPanelUnit
}

type AdLibPieceUiWithNext = AdLibPieceUi & { isNext: boolean }

function getVerticalOffsetFromHeight(el: DashboardPositionableElement) {
	return el.height < 0
		? el.heightUnit === DashboardPanelUnit.PERCENT
			? `calc(${-1 * el.height}% + var(--dashboard-panel-margin-height) / 2))`
			: `calc(${-1 * el.height - 1} * var(--dashboard-button-grid-height))`
		: undefined
}

function getHorizontalOffsetFromWidth(el: DashboardPositionableElement) {
	return el.width < 0
		? el.widthUnit === DashboardPanelUnit.PERCENT
			? `calc(${-1 * el.width}% + var(--dashboard-panel-margin-width) / 2))`
			: `calc(${-1 * el.width - 1} * var(--dashboard-button-grid-width))`
		: undefined
}

export function dashboardElementStyle(el: DashboardPositionableElement): React.CSSProperties {
	return {
		width:
			el.width >= 0
				? el.widthUnit === DashboardPanelUnit.PERCENT
					? `calc(${el.width}% - var(--dashboard-panel-margin-width))`
					: `calc((${el.width} * var(--dashboard-button-grid-width)) + var(--dashboard-panel-margin-width))`
				: undefined,
		height:
			el.height >= 0
				? el.heightUnit === DashboardPanelUnit.PERCENT
					? `calc(${el.height}% - var(--dashboard-panel-margin-height))`
					: `calc((${el.height} * var(--dashboard-button-grid-height)) + var(--dashboard-panel-margin-height))`
				: undefined,
		left:
			el.x >= 0
				? el.xUnit === DashboardPanelUnit.PERCENT
					? `calc(${el.x}% + var(--dashboard-panel-margin-width) / 2)`
					: `calc(${el.x} * var(--dashboard-button-grid-width))`
				: getHorizontalOffsetFromWidth(el),
		top:
			el.y >= 0
				? el.yUnit === DashboardPanelUnit.PERCENT
					? `calc(${el.y}% + var(--dashboard-panel-margin-height) / 2)`
					: `calc(${el.y} * var(--dashboard-button-grid-height))`
				: getVerticalOffsetFromHeight(el),
		right:
			el.x < 0
				? el.xUnit === DashboardPanelUnit.PERCENT
					? `calc(${-1 * el.x}% + var(--dashboard-panel-margin-width) / 2)`
					: `calc(${-1 * el.x - 1} * var(--dashboard-button-grid-width))`
				: getHorizontalOffsetFromWidth(el),
		bottom:
			el.y < 0
				? el.yUnit === DashboardPanelUnit.PERCENT
					? `calc(${-1 * el.y}% + var(--dashboard-panel-margin-height) / 2)`
					: `calc(${-1 * el.y - 1} * var(--dashboard-button-grid-height))`
				: getVerticalOffsetFromHeight(el),

		// @ts-expect-error css variables
		'--dashboard-panel-scale': el.scale || 1,
		'--dashboard-panel-scaled-font-size': (el.scale || 1) * 1.5 + 'em',
	}
}

export class DashboardPanelInner extends MeteorReactComponent<
	Translated<IAdLibPanelProps & IDashboardPanelProps & AdLibFetchAndFilterProps & IDashboardPanelTrackedProps>,
	IState
> {
	constructor(props: Translated<IAdLibPanelProps & AdLibFetchAndFilterProps>) {
		super(props)

		this.state = {
			outputLayers: {},
			sourceLayers: {},
			searchFilter: undefined,
			singleClickMode: false,
		}
	}

	static getDerivedStateFromProps(
		props: Translated<IAdLibPanelProps & AdLibFetchAndFilterProps>
	): Partial<IState> | null {
		if (props.showStyleBase && props.showStyleBase.outputLayers && props.showStyleBase.sourceLayers) {
			const tOLayers = props.showStyleBase.outputLayers
			const tSLayers = props.showStyleBase.sourceLayers

			return {
				outputLayers: tOLayers,
				sourceLayers: tSLayers,
			}
		}
		return null
	}

	componentDidMount() {
		this.autorun(() => {
			const unorderedRundownIds = RundownPlaylistCollectionUtil.getRundownUnorderedIDs(this.props.playlist)
			if (unorderedRundownIds.length > 0) {
				this.subscribe(PubSub.pieceInstances, {
					rundownId: {
						$in: unorderedRundownIds,
					},
					plannedStartedPlayback: {
						$exists: true,
					},
					$and: [
						{
							$or: [
								{
									adLibSourceId: {
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
						{
							$or: [
								{
									plannedStoppedPlayback: {
										$eq: 0,
									},
								},
								{
									plannedStoppedPlayback: {
										$exists: false,
									},
								},
							],
						},
					],
				})
			}
		})
	}

	componentDidUpdate(prevProps: IAdLibPanelProps & AdLibFetchAndFilterProps, prevState: IState) {
		const { selectedAdLib } = this.state
		const { selectedPiece } = this.props

		const newState: Partial<IState> = {}

		// Synchronize the internal selectedAdlib state with the outer selectedPiece
		if (
			selectedAdLib &&
			selectedAdLib !== prevState.selectedAdLib &&
			!(
				selectedPiece &&
				RundownUtils.isAdLibPieceOrAdLibListItem(selectedPiece) &&
				selectedPiece?._id === selectedAdLib._id
			)
		) {
			// If the local selectedAdLib is changing, inform the application that the selection has changed
			// (this will change the inspected AdLib in the inspector)
			this.props.onSelectPiece && this.props.onSelectPiece(selectedAdLib)
		} else if (
			selectedPiece &&
			selectedPiece !== prevProps.selectedPiece &&
			RundownUtils.isAdLibPieceOrAdLibListItem(selectedPiece)
		) {
			// If the outer selectedPiece is changing, we should check if it's present in this Panel. If it is
			// we should change our inner selectedAdLib state. If it isn't, we should leave it be, so that it
			// doesn't affect any selections the user may have made when using "displayTakeButtons".
			const memberAdLib = DashboardPanelInner.filterOutAdLibs(this.props, this.state).find(
				(adLib) => adLib._id === selectedPiece._id
			)
			if (memberAdLib) {
				newState.selectedAdLib = memberAdLib
			}
		}

		if (Object.keys(newState).length > 0) {
			this.setState(newState as IState)
		}
	}

	protected static filterOutAdLibs(
		props: IAdLibPanelProps & AdLibFetchAndFilterProps,
		state: IState,
		uniquenessIds?: Set<string>
	): AdLibPieceUi[] {
		const liveSegment = props.uiSegments.find((i) => i.isLive === true)
		return props.rundownBaselineAdLibs
			.concat(props.uiSegments.map((seg) => seg.pieces).flat())
			.filter((item) =>
				matchFilter(item, props.showStyleBase, liveSegment, props.filter, state.searchFilter, uniquenessIds)
			)
	}

	protected isAdLibOnAir(adLib: AdLibPieceUi) {
		return isAdLibOnAir(this.props.unfinishedAdLibIds, this.props.unfinishedTags, adLib)
	}

	protected isAdLibDisplayedAsOnAir(adLib: AdLibPieceUi) {
		return isAdLibDisplayedAsOnAir(this.props.unfinishedAdLibIds, this.props.unfinishedTags, adLib)
	}

	protected findNext(adLibs: AdLibPieceUi[]): AdLibPieceUiWithNext[] {
		return findNext(
			this.props.nextAdLibIds,
			this.props.unfinishedTags,
			this.props.nextTags,
			adLibs,
			!!this.props.filter?.nextInCurrentPart,
			!!this.props.filter?.oneNextPerSourceLayer
		)
	}

	protected onToggleOrSelectAdLib = (
		adlibPiece: AdLibPieceUi,
		queue: boolean,
		e: any,
		mode?: IBlueprintActionTriggerMode
	) => {
		const filter = this.props.filter as DashboardLayoutFilter | undefined
		if (filter?.displayTakeButtons) {
			this.onSelectAdLib(adlibPiece, e)
		} else {
			this.onToggleAdLib(adlibPiece, queue, e, mode)
		}
	}

	protected onToggleAdLib = (adlibPiece: AdLibPieceUi, queue: boolean, e: any, mode?: IBlueprintActionTriggerMode) => {
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

		const sourceLayer = this.props.sourceLayerLookup && this.props.sourceLayerLookup[adlibPiece.sourceLayerId]

		if (queue && sourceLayer && !sourceLayer.isQueueable) {
			console.log(`Item "${adlibPiece._id}" is on sourceLayer "${adlibPiece.sourceLayerId}" that is not queueable.`)
			return
		}
		if (this.props.playlist && this.props.playlist.currentPartInstanceId) {
			const currentPartInstanceId = this.props.playlist.currentPartInstanceId
			if (!this.isAdLibOnAir(adlibPiece) || !(sourceLayer && sourceLayer.isClearable)) {
				if (adlibPiece.isAction && adlibPiece.adlibAction) {
					const action = adlibPiece.adlibAction
					doUserAction(t, e, adlibPiece.isGlobal ? UserAction.START_GLOBAL_ADLIB : UserAction.START_ADLIB, (e, ts) =>
						MeteorCall.userAction.executeAction(
							e,
							ts,
							this.props.playlist._id,
							action._id,
							action.actionId,
							action.userData,
							mode?.data
						)
					)
				} else if (!adlibPiece.isGlobal && !adlibPiece.isAction) {
					doUserAction(t, e, UserAction.START_ADLIB, (e, ts) =>
						MeteorCall.userAction.segmentAdLibPieceStart(
							e,
							ts,
							this.props.playlist._id,
							currentPartInstanceId,
							adlibPiece._id,
							queue || false
						)
					)
				} else if (adlibPiece.isGlobal && !adlibPiece.isSticky) {
					doUserAction(t, e, UserAction.START_GLOBAL_ADLIB, (e, ts) =>
						MeteorCall.userAction.baselineAdLibPieceStart(
							e,
							ts,
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
				if (sourceLayer && sourceLayer.isClearable) {
					this.onClearAllSourceLayers([sourceLayer], e)
				}
			}
		}
	}

	protected onToggleSticky = (sourceLayerId: string, e: any) => {
		if (this.props.playlist && this.props.playlist.currentPartInstanceId && this.props.playlist.activationId) {
			const { t } = this.props
			doUserAction(t, e, UserAction.START_STICKY_PIECE, (e, ts) =>
				MeteorCall.userAction.sourceLayerStickyPieceStart(e, ts, this.props.playlist._id, sourceLayerId)
			)
		}
	}

	protected onClearAllSourceLayers = (sourceLayers: ISourceLayer[], e: any) => {
		const { t } = this.props
		if (this.props.playlist && this.props.playlist.currentPartInstanceId) {
			const playlistId = this.props.playlist._id
			const currentPartInstanceId = this.props.playlist.currentPartInstanceId
			doUserAction(t, e, UserAction.CLEAR_SOURCELAYER, (e, ts) =>
				MeteorCall.userAction.sourceLayerOnPartStop(
					e,
					ts,
					playlistId,
					currentPartInstanceId,
					_.map(sourceLayers, (sl) => sl._id)
				)
			)
		}
	}

	protected onFilterChange = (filter: string | undefined) => {
		this.setState({
			searchFilter: filter,
		})
	}

	protected onIn = (e: any) => {
		const { t } = this.props
		if (this.state.selectedAdLib) {
			const piece = this.state.selectedAdLib
			const sourceLayer = this.props.sourceLayerLookup && this.props.sourceLayerLookup[piece.sourceLayerId]
			const currentPartInstanceId = this.props.playlist.currentPartInstanceId
			if (this.props.playlist && currentPartInstanceId) {
				if (!this.isAdLibOnAir(piece) || !(sourceLayer && sourceLayer.isClearable)) {
					if (piece.isAction && piece.adlibAction) {
						const action = piece.adlibAction
						doUserAction(t, e, piece.isGlobal ? UserAction.START_GLOBAL_ADLIB : UserAction.START_ADLIB, (e, ts) =>
							MeteorCall.userAction.executeAction(
								e,
								ts,
								this.props.playlist._id,
								action._id,
								action.actionId,
								action.userData
							)
						)
					} else if (!piece.isGlobal) {
						doUserAction(t, e, UserAction.START_ADLIB, (e, ts) =>
							MeteorCall.userAction.segmentAdLibPieceStart(
								e,
								ts,
								this.props.playlist._id,
								currentPartInstanceId,
								piece._id,
								false
							)
						)
					} else if (piece.isGlobal && !piece.isSticky) {
						doUserAction(t, e, UserAction.START_GLOBAL_ADLIB, (e, ts) =>
							MeteorCall.userAction.baselineAdLibPieceStart(
								e,
								ts,
								this.props.playlist._id,
								currentPartInstanceId,
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

	protected onOut = (e: any, outButton?: boolean) => {
		if (this.state.selectedAdLib) {
			const piece = this.state.selectedAdLib
			const sourceLayer = this.props.sourceLayerLookup && this.props.sourceLayerLookup[piece.sourceLayerId]
			if (sourceLayer && (sourceLayer.isClearable || outButton)) {
				this.onClearAllSourceLayers([sourceLayer], e)
			}
		}
	}

	protected onSelectAdLib = (piece: AdLibPieceUi, _e: any) => {
		this.setState({
			selectedAdLib: piece,
		})
	}

	protected setRef = (ref: HTMLDivElement) => {
		const _panel = ref
		if (_panel) {
			const style = window.getComputedStyle(_panel)
			// check if a special variable is set through CSS to indicate that we shouldn't expect
			// double clicks to trigger AdLibs
			const value = style.getPropertyValue(USER_AGENT_POINTER_PROPERTY)
			const shouldBeSingleClick = !!value.match(UserAgentPointer.NO_POINTER)
			if (this.state.singleClickMode !== shouldBeSingleClick) {
				this.setState({
					singleClickMode: shouldBeSingleClick,
				})
			}
		}
	}

	render() {
		const { t } = this.props
		const uniquenessIds = new Set<string>()
		const filteredAdLibs = this.findNext(DashboardPanelInner.filterOutAdLibs(this.props, this.state, uniquenessIds))
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
						ref={this.setRef}
						style={dashboardElementStyle(filter)}
					>
						<h4 className="dashboard-panel__header">{this.props.filter.name}</h4>
						{filter.enableSearch && (
							<AdLibPanelToolbar onFilterChange={this.onFilterChange} searchFilter={this.state.searchFilter} />
						)}
						<div
							className={ClassNames('dashboard-panel__panel', {
								'dashboard-panel__panel--horizontal': filter.overflowHorizontally,
							})}
						>
							{filteredAdLibs.map((adLibPiece: AdLibPieceUiWithNext) => {
								return (
									<ContextMenuTrigger
										id="shelf-context-menu"
										collect={() =>
											setShelfContextMenuContext({
												type: ContextType.ADLIB,
												details: {
													adLib: adLibPiece,
													onToggle: !adLibPiece.disabled ? this.onToggleAdLib : undefined,
													disabled: adLibPiece.disabled,
												},
											})
										}
										renderTag="span"
										key={unprotectString(adLibPiece._id)}
										holdToDisplay={contextMenuHoldToDisplayTime()}
									>
										<DashboardPieceButton
											piece={adLibPiece}
											studio={this.props.studio}
											layer={this.state.sourceLayers[adLibPiece.sourceLayerId]}
											outputLayer={this.state.outputLayers[adLibPiece.outputLayerId]}
											onToggleAdLib={this.onToggleOrSelectAdLib}
											onSelectAdLib={this.onSelectAdLib}
											playlist={this.props.playlist}
											isOnAir={this.isAdLibDisplayedAsOnAir(adLibPiece)}
											isNext={adLibPiece.isNext}
											mediaPreviewUrl={
												this.props.studio
													? ensureHasTrailingSlash(this.props.studio.settings.mediaPreviewsUrl + '' || '') || ''
													: ''
											}
											widthScale={filter.buttonWidthScale}
											heightScale={filter.buttonHeightScale}
											displayStyle={filter.displayStyle}
											showThumbnailsInList={filter.showThumbnailsInList}
											disableHoverInspector={filter.disableHoverInspector ?? false}
											toggleOnSingleClick={filter.toggleOnSingleClick || this.state.singleClickMode}
											isSelected={this.state.selectedAdLib && adLibPiece._id === this.state.selectedAdLib._id}
											disabled={adLibPiece.disabled}
										>
											{adLibPiece.name}
										</DashboardPieceButton>
									</ContextMenuTrigger>
								)
							})}
						</div>
						{filter.displayTakeButtons && (
							<div className="dashboard-panel__buttons">
								<div
									className={ClassNames('dashboard-panel__panel__button')}
									onClick={(e) => {
										this.onIn(e)
									}}
								>
									<span className="dashboard-panel__panel__button__label">{t('In')}</span>
								</div>
								<div
									className={ClassNames('dashboard-panel__panel__button')}
									onClick={(e) => {
										this.onOut(e, true)
									}}
								>
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

export function findNext(
	nextAdLibIds: IDashboardPanelTrackedProps['nextAdLibIds'],
	unfinishedTags: IDashboardPanelTrackedProps['unfinishedTags'],
	nextTags: IDashboardPanelTrackedProps['nextTags'],
	adLibs: AdLibPieceUi[],
	nextInCurrentPart: boolean,
	oneNextPerSourceLayer: boolean
): Array<AdLibPieceUi & { isNext: boolean }> {
	const nextAdlibs: Set<PieceId> = new Set()
	const nextAdlibsPerLayer: Map<string, PieceId> = new Map()
	const checkAndSet = (adLib: AdLibPieceUi) => {
		if (oneNextPerSourceLayer) {
			if (nextAdlibsPerLayer.has(adLib.sourceLayerId)) {
				return
			} else {
				nextAdlibsPerLayer.set(adLib.sourceLayerId, adLib._id)
			}
		}
		nextAdlibs.add(adLib._id)
	}
	adLibs.forEach((adLib) => {
		if (isAdLibNext(nextAdLibIds, nextTags, adLib)) {
			checkAndSet(adLib)
		}
	})
	if (nextInCurrentPart) {
		adLibs.forEach((adLib) => {
			if (adLib.nextPieceTags && adLib.nextPieceTags.every((tag) => unfinishedTags.includes(tag))) {
				checkAndSet(adLib)
			}
		})
	}
	return adLibs.map((adLib) => {
		return {
			...adLib,
			isNext: nextAdlibs.has(adLib._id),
		}
	})
}

export const DashboardPanel = translateWithTracker<
	Translated<IAdLibPanelProps & IDashboardPanelProps>,
	IState,
	AdLibFetchAndFilterProps & IDashboardPanelTrackedProps
>(
	(props: Translated<IAdLibPanelProps>) => {
		const studio = UIStudios.findOne(props.playlist.studioId)
		if (!studio) throw new Meteor.Error(404, 'Studio "' + props.playlist.studioId + '" not found!')

		const { unfinishedAdLibIds, unfinishedTags } = getUnfinishedPieceInstancesGrouped(
			props.playlist,
			props.showStyleBase
		)
		const { nextAdLibIds, nextTags } = getNextPieceInstancesGrouped(props.playlist, props.showStyleBase)
		return {
			...fetchAndFilter(props),
			studio,
			unfinishedAdLibIds,
			unfinishedTags,
			nextAdLibIds,
			nextTags,
		}
	},
	(_data, props: IAdLibPanelProps, nextProps: IAdLibPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(DashboardPanelInner)
