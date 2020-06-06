import * as React from 'react'
import * as _ from 'underscore'
import { RundownLayoutBase, RundownLayoutElementType, PieceDisplayStyle, RundownLayoutAdLibRegion, RundownLayoutAdLibRegionRole, DashboardLayoutAdLibRegion } from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { dashboardElementPosition } from './DashboardPanel'
import { Rundown } from '../../../lib/collections/Rundowns'
import * as classNames from 'classnames'
import { AdLibPieceUi, IAdLibPanelProps, IAdLibPanelTrackedProps, fetchAndFilter, matchFilter } from './AdLibPanel'
import { UserActionAPI } from '../../../lib/api/userActions'
import { doUserAction } from '../../lib/userAction'
import { Studio } from '../../../lib/collections/Studios'
import { Piece, Pieces } from '../../../lib/collections/Pieces'
import { translateWithTracker, Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications'
import { getNextPart } from '../../../server/api/playout/lib'
import { getCurrentTime } from '../../../lib/lib'
import { PieceLifespan, ISourceLayer, SourceLayerType, VTContent, LiveSpeakContent, GraphicsContent } from 'tv-automation-sofie-blueprints-integration'
import { invalidateAt } from '../../lib/invalidatingTime'
import { MediaObject } from '../../../lib/collections/MediaObjects'
import { ensureHasTrailingSlash } from '../../lib/lib'
import { checkPieceContentStatus } from '../../../lib/mediaObjects'
import { Meteor } from 'meteor/meteor'

interface IState {
}

interface IAdLibRegionPanelProps {
	layout: RundownLayoutBase
	panel: RundownLayoutAdLibRegion
	visible: boolean
	rundown: Rundown
	adlibRank?: number
}

interface IAdLibRegionPanelTrackedProps {
	studio?: Studio
	unfinishedPieces: {
		[key: string]: Piece[]
	}
	nextPieces: {
		[key: string]: Piece[]
	}
	metadata?: MediaObject
	thumbnailPiece?: Piece
	layer?: ISourceLayer
}

export class AdLibRegionPanelInner extends MeteorReactComponent<Translated<IAdLibPanelProps & IAdLibRegionPanelProps & IAdLibPanelTrackedProps & IAdLibRegionPanelTrackedProps>, IState> {

	private objId: string

	constructor (props: Translated<IAdLibPanelProps & IAdLibPanelTrackedProps>) {
		super(props)

	}

	componentDidMount () {
		Meteor.defer(() => {
			this.updateMediaObjectSubscription()
		})
	}

	componentDidUpdate () {
		Meteor.defer(() => {
			this.updateMediaObjectSubscription()
		})
	}

	isAdLibOnAir (adLib: AdLibPieceUi) {
		if (this.props.unfinishedPieces[adLib._id] && this.props.unfinishedPieces[adLib._id].length > 0) {
			return true
		}
		return false
	}

	isAdLibNext (adLib: AdLibPieceUi) {
		if (this.props.nextPieces[adLib._id] && this.props.nextPieces[adLib._id].length > 0) {
			return true
		}
		return false
	}

	onToggleSticky = (sourceLayerId: string, e: any) => {
		if (this.props.rundown && this.props.rundown.currentPartId && this.props.rundown.active) {
			const { t } = this.props
			doUserAction(t, e, UserActionAPI.methods.sourceLayerStickyPieceStart, [this.props.rundown._id, sourceLayerId])
		}
	}

	toggleAdLib (e: any, piece?: AdLibPieceUi, queueWhenOnAir?: boolean) {
		const { t } = this.props
		if (!piece) {
			return
		}

		if (piece.invalid) {
			NotificationCenter.push(new Notification(
				t('Invalid AdLib'),
				NoticeLevel.WARNING,
				t('Cannot play this AdLib because it is marked as Invalid'),
				'toggleAdLib'))
			return
		}

		if ((!this.isAdLibOnAir(piece) || queueWhenOnAir) && this.props.rundown && this.props.rundown.currentPartId) {
			if (!piece.isGlobal) {
				doUserAction(t, e, UserActionAPI.methods.segmentAdLibPieceStart, [
					this.props.rundown._id, this.props.rundown.currentPartId, piece._id, true
				])
			} else if (piece.isGlobal && !piece.isSticky) {
				doUserAction(t, e, UserActionAPI.methods.baselineAdLibPieceStart, [
					this.props.rundown._id, this.props.rundown.currentPartId, piece._id, true
				])
			} else if (piece.isSticky) {
				this.onToggleSticky(piece.sourceLayerId, e)
			}
		}
	}

	take = (e: any) => {
		const { t } = this.props
		if (this.props.studioMode) {
			doUserAction(t, e, UserActionAPI.methods.take, [this.props.rundown._id])
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
		const mediaPreviewUrl = this.props.studio ? ensureHasTrailingSlash(this.props.studio.settings.mediaPreviewsUrl + '' || '') || '' : ''
		if (mediaPreviewUrl && metadata) {
			if (metadata && metadata.previewPath && mediaPreviewUrl) {
				return mediaPreviewUrl + 'media/thumbnail/' + encodeURIComponent(metadata.mediaId)
			}
		}
		return undefined
	}

	renderPreview () {
		if (this.props.metadata) {
			const previewUrl = this.getPreviewUrl()
			if (previewUrl) {
				return <img src={previewUrl} className='adlib-region-panel__image' />
			}
		}
	}

	updateMediaObjectSubscription () {
		if (this.props.thumbnailPiece) {
			const piece = this.props.thumbnailPiece as any as AdLibPieceUi
			let objId: string | undefined = undefined

			if (piece.content && this.props.layer) {
				switch (this.props.layer.type) {
					case SourceLayerType.VT:
						objId = (piece.content as VTContent).fileName.toUpperCase()
						break
					case SourceLayerType.LIVE_SPEAK:
						objId = (piece.content as LiveSpeakContent).fileName.toUpperCase()
						break
					case SourceLayerType.GRAPHICS:
						objId = (piece.content as GraphicsContent).fileName.toUpperCase()
						break
				}
			}

			if (objId && this.objId !== this.objId) {
				this.objId = objId
			}
		}
	}

	render () {
		const isTake = this.props.panel.role === RundownLayoutAdLibRegionRole.TAKE
		const isProgram = this.props.panel.role === RundownLayoutAdLibRegionRole.PROGRAM
		const isLarge = isProgram || isTake
		const piece = this.props.panel.tags && this.props.rundownBaselineAdLibs ?
		this.props.rundownBaselineAdLibs.concat(_.flatten(this.props.uiSegments.map(seg => seg.pieces))).filter((item) => matchFilter(item, this.props.showStyleBase, this.props.uiSegments, this.props.filter))[this.props.adlibRank ? this.props.adlibRank : 0] : undefined
		return <div className='adlib-region-panel'
			style={
				_.extend(
					RundownLayoutsAPI.isDashboardLayout(this.props.layout) ?
						dashboardElementPosition(this.props.panel as DashboardLayoutAdLibRegion) :
						{},
					{
						'visibility': this.props.visible ? 'visible' : 'hidden'
					}
				)
			}>
			<div className={classNames('adlib-region-panel__image-container', {
				'next': piece && this.isAdLibNext(piece),
				'on-air': piece && this.isAdLibOnAir(piece),
				'has-preview': this.props.panel.thumbnailSourceLayerIds && this.props.panel.thumbnailSourceLayerIds.length > 0
			})} >
				<div className='adlib-region-panel__button'
					onClick={(e) => this.onAction(e, piece)}
				>
					{this.renderPreview()}
					{
					<span className={classNames('adlib-region-panel__label',{
						'adlib-region-panel__label--large': isLarge
					})}>{this.props.panel.name}</span>
					}
				</div>
			</div>
		</div>
	}
}


export function getNextPiecesReactive (rundownId: string, nextPartId: string | null) {
	let prospectivePieces: Piece[] = []
	if (nextPartId) {
		prospectivePieces = Pieces.find({
			partId: nextPartId,
			rundownId: rundownId,
			adLibSourceId: {
				$exists: true
			},
		}).fetch()
	}

	return _.groupBy(prospectivePieces, (piece) => piece.adLibSourceId)
}


export function getUnfinishedPiecesReactive (rundownId: string, currentPartId: string | null) {
	let prospectivePieces: Piece[] = []
	const now = getCurrentTime()
	if (currentPartId) {
		prospectivePieces = Pieces.find({
			rundownId: rundownId,
			// dynamicallyInserted: true,
			startedPlayback: {
				$exists: true
			},
			$and: [
				{
					$or: [{
						stoppedPlayback: {
							$eq: 0
						}
					}, {
						stoppedPlayback: {
							$exists: false
						}
					}],
				},
				{
					definitelyEnded: {
						$exists: false
					}
				}
			],
			playoutDuration: {
				$exists: false
			},
			adLibSourceId: {
				$exists: true
			},
			$or: [
				{
					userDuration: {
						$exists: false
					}
				},
				{
					'userDuration.duration': {
						$exists: false
					}
				}
			]
		}).fetch()

		let nearestEnd = Number.POSITIVE_INFINITY
		prospectivePieces = prospectivePieces.filter((piece) => {
			if (piece.definitelyEnded) return false
			if (piece.startedPlayback === undefined && piece.continuesRefId === undefined) return false
			if (piece.stoppedPlayback) return false

			let duration: number | undefined =
				(piece.playoutDuration) ?
					piece.playoutDuration :
				(piece.userDuration && typeof piece.userDuration.duration === 'number') ?
					piece.userDuration.duration :
				(piece.userDuration && typeof piece.userDuration.end === 'string') ?
					0 : // TODO: obviously, it would be best to evaluate this, but for now we assume that userDuration of any sort is probably in the past
				(typeof piece.enable.duration === 'number') ?
					piece.enable.duration :
					undefined

			if (duration !== undefined) {
				const end = ((piece.startedPlayback || 0) + duration)
				if (end > now) {
					nearestEnd = nearestEnd > end ? end : nearestEnd
					return true
				} else {
					return false
				}
			}

			if (piece.infiniteMode && piece.infiniteMode >= PieceLifespan.Infinite) {
				return true
			}
			return true
		})

		if (Number.isFinite(nearestEnd)) invalidateAt(nearestEnd)
	}

	return _.groupBy(prospectivePieces, (piece) => piece.adLibSourceId)
}


export const AdLibRegionPanel = translateWithTracker<Translated<IAdLibPanelProps & IAdLibRegionPanelProps>, IState, IAdLibPanelTrackedProps & IAdLibRegionPanelTrackedProps>((props: Translated<IAdLibPanelProps & IAdLibRegionPanelProps>) => {
	const studio = props.rundown.getStudio()
	const unfinishedPieces = getUnfinishedPiecesReactive(props.rundown._id, props.rundown.currentPartId)
	const nextPieces = getNextPiecesReactive(props.rundown._id, props.rundown.nextPartId)
	const thumbnailPiece = props.panel.thumbnailSourceLayerIds && props.panel.thumbnailSourceLayerIds.length ?
	_.find([..._.flatten(_.values(nextPieces)), ..._.flatten(_.values(unfinishedPieces))], piece => {
		return (props.panel.thumbnailSourceLayerIds || []).indexOf(piece.sourceLayerId) !== -1
	}) : undefined
	const layer = thumbnailPiece && props.showStyleBase.sourceLayers.find(layer => thumbnailPiece.sourceLayerId === layer._id)
	const { metadata } = thumbnailPiece ? checkPieceContentStatus(thumbnailPiece, props.showStyleBase.sourceLayers.find(layer => thumbnailPiece.sourceLayerId === layer._id), studio.settings) : { metadata: undefined }
	return Object.assign({}, fetchAndFilter(props), {
		studio,
		unfinishedPieces,
		nextPieces,
		thumbnailPiece,
		layer,
		metadata: metadata ? metadata : undefined
	})
}, (data, props: IAdLibPanelProps, nextProps: IAdLibPanelProps) => {
	return !_.isEqual(props, nextProps)
})(AdLibRegionPanelInner)
