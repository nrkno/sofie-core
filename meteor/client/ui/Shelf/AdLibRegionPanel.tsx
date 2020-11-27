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
import { AdLibPieceUi, IAdLibPanelProps, IAdLibPanelTrackedProps, fetchAndFilter, matchFilter } from './AdLibPanel'
import { doUserAction, UserAction } from '../../lib/userAction'
import { translateWithTracker, Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications'
import { unprotectString } from '../../../lib/lib'
import { PartInstanceId } from '../../../lib/collections/PartInstances'
import { PieceInstance } from '../../../lib/collections/PieceInstances'
import { MeteorCall } from '../../../lib/api/methods'
import { MediaObject } from '../../../lib/collections/MediaObjects'
import {
	ISourceLayer,
	SourceLayerType,
	VTContent,
	LiveSpeakContent,
	GraphicsContent,
} from 'tv-automation-sofie-blueprints-integration'
import { Meteor } from 'meteor/meteor'
import { ensureHasTrailingSlash } from '../../lib/lib'
import { PubSub } from '../../../lib/api/pubsub'
import { checkPieceContentStatus } from '../../../lib/mediaObjects'

interface IState {
	objId?: string
}

interface IAdLibRegionPanelProps {
	layout: RundownLayoutBase
	panel: RundownLayoutAdLibRegion
	visible: boolean
	adlibRank?: number
}

interface IAdLibRegionPanelTrackedProps extends IDashboardPanelTrackedProps {
	metadata: MediaObject | null
	thumbnailPiece: PieceInstance
	layer?: ISourceLayer
}

export class AdLibRegionPanelInner extends MeteorReactComponent<
	Translated<IAdLibPanelProps & IAdLibRegionPanelProps & IAdLibPanelTrackedProps & IAdLibRegionPanelTrackedProps>,
	IState
> {
	constructor(props: Translated<IAdLibPanelProps & IAdLibPanelTrackedProps>) {
		super(props)

		this.state = {}
	}

	componentDidMount() {
		Meteor.defer(() => {
			this.updateMediaObjectSubscription()
		})
	}

	componentDidUpdate() {
		Meteor.defer(() => {
			this.updateMediaObjectSubscription()
		})
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

	getPreviewUrl = (): string | undefined => {
		const { metadata } = this.props
		const mediaPreviewUrl =
			ensureHasTrailingSlash(this.props.playlist.getStudio().settings.mediaPreviewsUrl + '' || '') || ''

		if (mediaPreviewUrl && metadata) {
			if (metadata && metadata.previewPath && mediaPreviewUrl) {
				return mediaPreviewUrl + 'media/thumbnail/' + encodeURIComponent(metadata.mediaId)
			}
		}
		return undefined
	}

	renderPreview() {
		if (this.props.metadata) {
			const previewUrl = this.getPreviewUrl()
			if (previewUrl) {
				return <img src={previewUrl} className="multiview-panel__image" />
			}
		}
	}

	updateMediaObjectSubscription() {
		if (this.props.thumbnailPiece) {
			const piece = (this.props.thumbnailPiece as any) as AdLibPieceUi
			let objId: string | undefined = undefined

			if (piece.content && piece.content.fileName && this.props.layer) {
				switch (this.props.layer.type) {
					case SourceLayerType.VT:
						objId = (piece.content as VTContent).fileName?.toUpperCase()
						break
					case SourceLayerType.LIVE_SPEAK:
						objId = (piece.content as LiveSpeakContent).fileName?.toUpperCase()
						break
					case SourceLayerType.GRAPHICS:
						if (piece.content.fileName) {
							objId = (piece.content as GraphicsContent).fileName?.toUpperCase()
						}
						break
				}
			}

			if (objId && objId !== this.state.objId) {
				this.setState({ objId })
				this.subscribe(PubSub.mediaObjects, this.props.playlist.studioId, {
					mediaId: objId,
				})
			}
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
						'has-preview':
							this.props.panel.thumbnailSourceLayerIds && this.props.panel.thumbnailSourceLayerIds.length > 0,
					})}>
					<div className="adlib-region-panel__button" onClick={(e) => this.onAction(e, piece)}>
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

export const AdLibRegionPanel = translateWithTracker<
	Translated<IAdLibPanelProps & IAdLibRegionPanelProps>,
	IState,
	IAdLibPanelTrackedProps & IAdLibRegionPanelTrackedProps
>(
	(props: Translated<IAdLibPanelProps & IAdLibRegionPanelProps>) => {
		const studio = props.playlist.getStudio()
		const { unfinishedAdLibIds, unfinishedTags, unfinishedPieceInstances } = getUnfinishedPieceInstancesGrouped(
			props.playlist.currentPartInstanceId
		)
		const { nextAdLibIds, nextTags, nextPieceInstances } = getNextPieceInstancesGrouped(
			props.playlist.nextPartInstanceId
		)
		const thumbnailPiece =
			props.panel.thumbnailSourceLayerIds && props.panel.thumbnailSourceLayerIds.length
				? _.find(
						[..._.flatten(_.values(unfinishedPieceInstances)), ..._.flatten(_.values(nextPieceInstances))],
						(piece) => {
							return (props.panel.thumbnailSourceLayerIds || []).indexOf(piece.sourceLayerId) !== -1
						}
				  )
				: undefined
		const layer =
			thumbnailPiece && props.showStyleBase.sourceLayers.find((layer) => thumbnailPiece.sourceLayerId === layer._id)
		const { metadata } = thumbnailPiece
			? checkPieceContentStatus(
					thumbnailPiece,
					props.showStyleBase.sourceLayers.find((layer) => thumbnailPiece.sourceLayerId === layer._id),
					studio.settings
			  )
			: { metadata: null }
		return Object.assign({}, fetchAndFilter(props), {
			studio: studio,
			unfinishedAdLibIds,
			unfinishedTags,
			nextAdLibIds,
			nextTags,
			metadata,
			thumbnailPiece,
			layer,
		})
	},
	(data, props: IAdLibPanelProps, nextProps: IAdLibPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(AdLibRegionPanelInner)
