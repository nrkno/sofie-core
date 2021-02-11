import * as React from 'react'
import * as _ from 'underscore'
import {
	RundownLayoutBase,
	RundownLayoutAdLibRegion,
	DashboardLayoutAdLibRegion,
	RundownLayoutAdLibRegionRole,
} from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import {
	dashboardElementPosition,
	IDashboardPanelTrackedProps,
	getUnfinishedPieceInstancesGrouped,
	getNextPieceInstancesGrouped,
	isAdLibOnAir,
	isAdLibNext,
} from './DashboardPanel'
import ClassNames from 'classnames'
import { AdLibPieceUi, IAdLibPanelProps, AdLibFetchAndFilterProps, fetchAndFilter, matchFilter } from './AdLibPanel'
import { doUserAction, UserAction } from '../../lib/userAction'
import { translateWithTracker, Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications'
import { MeteorCall } from '../../../lib/api/methods'
import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { withMediaObjectStatus } from '../SegmentTimeline/withMediaObjectStatus'
import { PieceUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { PieceInstance } from '../../../lib/collections/PieceInstances'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { ensureHasTrailingSlash } from '../../lib/lib'

interface IState {}

interface IAdLibRegionPanelProps {
	layout: RundownLayoutBase
	panel: RundownLayoutAdLibRegion
	visible: boolean
	adlibRank?: number
}

interface IAdLibRegionPanelTrackedProps extends IDashboardPanelTrackedProps {
	piece?: PieceUi | undefined
	layer?: ISourceLayer
	isLiveLine: boolean
}

export class AdLibRegionPanelBase extends MeteorReactComponent<
	Translated<IAdLibPanelProps & IAdLibRegionPanelProps & AdLibFetchAndFilterProps & IAdLibRegionPanelTrackedProps>,
	IState
> {
	constructor(props: Translated<IAdLibPanelProps & AdLibFetchAndFilterProps>) {
		super(props)

		this.state = {}
	}

	isAdLibOnAir(adLib: AdLibPieceUi) {
		return isAdLibOnAir(this.props.unfinishedAdLibIds, this.props.unfinishedTags, adLib)
	}

	isAdLibNext(adLib: AdLibPieceUi) {
		return isAdLibNext(this.props.nextAdLibIds, this.props.unfinishedTags, this.props.nextTags, adLib)
	}

	onToggleSticky = (sourceLayerId: string, e: any) => {
		if (this.props.playlist && this.props.playlist.currentPartInstanceId && this.props.playlist.active) {
			const { t } = this.props
			doUserAction(t, e, UserAction.START_STICKY_PIECE, (e) =>
				MeteorCall.userAction.sourceLayerStickyPieceStart(e, this.props.playlist._id, sourceLayerId)
			)
		}
	}

	toggleAdLib(e: any, piece?: AdLibPieceUi, queueWhenOnAir?: boolean) {
		const { t } = this.props
		if (!piece) {
			return
		}

		if (piece.invalid) {
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

		const currentPartInstanceId = this.props.playlist.currentPartInstanceId

		if ((!this.isAdLibOnAir(piece) || queueWhenOnAir) && this.props.playlist && currentPartInstanceId) {
			if (piece.isAction && piece.adlibAction) {
				const action = piece.adlibAction
				doUserAction(t, e, piece.isGlobal ? UserAction.START_GLOBAL_ADLIB : UserAction.START_ADLIB, (e) =>
					MeteorCall.userAction.executeAction(e, this.props.playlist._id, action.actionId, action.userData)
				)
			} else if (!piece.isGlobal && !piece.isAction) {
				doUserAction(t, e, UserAction.START_ADLIB, (e) =>
					MeteorCall.userAction.segmentAdLibPieceStart(
						e,
						this.props.playlist._id,
						currentPartInstanceId,
						piece._id,
						true
					)
				)
			} else if (piece.isGlobal && !piece.isSticky) {
				doUserAction(t, e, UserAction.START_GLOBAL_ADLIB, (e) =>
					MeteorCall.userAction.baselineAdLibPieceStart(
						e,
						this.props.playlist._id,
						currentPartInstanceId,
						piece._id,
						true
					)
				)
			} else if (piece.isSticky) {
				this.onToggleSticky(piece.sourceLayerId, e)
			}
		}
	}

	take = (e: any) => {
		const { t } = this.props
		if (this.props.studioMode) {
			doUserAction(t, e, UserAction.TAKE, (e) => MeteorCall.userAction.take(e, this.props.playlist._id))
		}
	}

	onAction = (e: any, piece?: AdLibPieceUi) => {
		switch (this.props.panel.role) {
			case RundownLayoutAdLibRegionRole.QUEUE:
				this.toggleAdLib(e, piece, true)
				break
			case RundownLayoutAdLibRegionRole.TAKE:
				this.take(e)
				break
			case RundownLayoutAdLibRegionRole.PROGRAM:
				break
		}
	}

	getThumbnailUrl = (): string | undefined => {
		const { piece } = this.props
		const { mediaPreviewsUrl } = this.props.studio.settings
		if (piece && piece.contentMetaData && piece.contentMetaData.previewPath && mediaPreviewsUrl) {
			return (
				ensureHasTrailingSlash(mediaPreviewsUrl) +
				'/media/thumbnail/' +
				encodeURIComponent(piece.contentMetaData.mediaId)
			)
		}
		return undefined
	}

	renderPreview() {
		const thumbnailUrl = this.getThumbnailUrl()
		if (thumbnailUrl) {
			return <img src={thumbnailUrl} className="multiview-panel__image" />
		}
	}

	render() {
		const piece =
			this.props.panel.tags && this.props.rundownBaselineAdLibs
				? this.props.rundownBaselineAdLibs
						.concat(_.flatten(this.props.uiSegments.map((seg) => seg.pieces)))
						.filter((item) => matchFilter(item, this.props.showStyleBase, this.props.uiSegments, this.props.filter))[
						this.props.adlibRank ? this.props.adlibRank : 0
				  ]
				: undefined
		return (
			<div
				className="adlib-region-panel"
				style={_.extend(
					RundownLayoutsAPI.isDashboardLayout(this.props.layout)
						? dashboardElementPosition(this.props.panel as DashboardLayoutAdLibRegion)
						: {},
					{
						visibility: this.props.visible ? 'visible' : 'hidden',
					}
				)}>
				<div
					className={ClassNames('adlib-region-panel__image-container', {
						next: piece && this.isAdLibNext(piece),
						'on-air': piece && this.isAdLibOnAir(piece),
						blackout: !!this.props.piece || (this.props.panel.showBlackIfNoThumbnailPiece && !this.getThumbnailUrl()),
					})}>
					<div className="adlib-region-panel__button" onClick={(e) => this.onAction(e, piece)}>
						{this.renderPreview()}
						{
							<span
								className={ClassNames('adlib-region-panel__label', {
									'adlib-region-panel__label--large': this.props.panel.labelBelowPanel,
								})}>
								{this.props.panel.name}
							</span>
						}
					</div>
				</div>
			</div>
		)
	}
}

export const AdLibRegionPanelWithStatus = withMediaObjectStatus<
	Translated<IAdLibPanelProps & IAdLibRegionPanelProps & AdLibFetchAndFilterProps & IAdLibRegionPanelTrackedProps>,
	{}
>()(AdLibRegionPanelBase)

export const AdLibRegionPanel = translateWithTracker<
	Translated<IAdLibPanelProps & IAdLibRegionPanelProps>,
	IState,
	AdLibFetchAndFilterProps & IAdLibRegionPanelTrackedProps
>(
	(props: Translated<IAdLibPanelProps & IAdLibRegionPanelProps>) => {
		const studio = props.playlist.getStudio()
		const { unfinishedAdLibIds, unfinishedTags, unfinishedPieceInstances } = getUnfinishedPieceInstancesGrouped(
			props.playlist.currentPartInstanceId
		)
		const { nextAdLibIds, nextTags, nextPieceInstances } = getNextPieceInstancesGrouped(
			props.showStyleBase,
			props.playlist.nextPartInstanceId
		)

		// Pick thumbnails to display
		const nextThumbnail: PieceInstance | undefined = nextPieceInstances.find((p) =>
			props.panel.thumbnailSourceLayerIds?.includes(p.piece.sourceLayerId)
		)
		const currentThumbnail: PieceInstance | undefined = !props.panel.hideThumbnailsForActivePieces
			? unfinishedPieceInstances.find((p) => props.panel.thumbnailSourceLayerIds?.includes(p.piece.sourceLayerId))
			: undefined
		const thumbnailPiece: PieceInstance | undefined = props.panel.thumbnailPriorityNextPieces
			? nextThumbnail ?? currentThumbnail
			: currentThumbnail ?? nextThumbnail

		const pieceUi: PieceUi | undefined = thumbnailPiece
			? {
					instance: thumbnailPiece,
					renderedInPoint: null,
					renderedDuration: null,
			  }
			: undefined

		const sourceLayer =
			thumbnailPiece &&
			props.showStyleBase.sourceLayers.find((layer) => thumbnailPiece.piece.sourceLayerId === layer._id)

		return Object.assign({}, fetchAndFilter(props), {
			studio,
			piece: pieceUi,
			layer: sourceLayer,
			unfinishedAdLibIds,
			unfinishedTags,
			nextAdLibIds,
			nextTags,
			isLiveLine: false,
		})
	},
	(data, props: IAdLibPanelProps, nextProps: IAdLibPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(AdLibRegionPanelWithStatus)
