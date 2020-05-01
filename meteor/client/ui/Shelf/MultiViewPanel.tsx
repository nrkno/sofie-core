import * as React from 'react'
import * as _ from 'underscore'
import { RundownLayoutBase, RundownLayoutMultiView, DashboardLayoutMultiView, RundownLayoutMultiViewRole, RundownLayoutElementType, PieceDisplayStyle } from '../../../lib/collections/RundownLayouts'
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
import { PieceLifespan } from 'tv-automation-sofie-blueprints-integration'
import { invalidateAt } from '../../lib/invalidatingTime'

interface IState {
}

interface IMultiViewPanelProps {
	layout: RundownLayoutBase
	panel: RundownLayoutMultiView
	visible: boolean
	rundown: Rundown
	adlibRank?: number
}

interface IMultiViewPanelTrackedProps {
	studio?: Studio
	unfinishedPieces: {
		[key: string]: Piece[]
	}
	nextPieces: {
		[key: string]: Piece[]
	}
}

export class MultiViewPanelInner extends MeteorReactComponent<Translated<IAdLibPanelProps & IMultiViewPanelProps & IAdLibPanelTrackedProps & IMultiViewPanelTrackedProps>, IState> {

	constructor (props: Translated<IAdLibPanelProps & IAdLibPanelTrackedProps>) {
		super(props)

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
			case RundownLayoutMultiViewRole.QUEUE:
				this.toggleAdLib(e, piece, true)
				break
			case RundownLayoutMultiViewRole.TAKE:
				this.take(e)
				break
			case RundownLayoutMultiViewRole.PROGRAM:
				break
		}
	}

	render () {
		const isTake = this.props.panel.role === RundownLayoutMultiViewRole.TAKE
		const isProgram = this.props.panel.role === RundownLayoutMultiViewRole.PROGRAM
		const isLarge = isProgram || isTake
		const piece = this.props.panel.tags && this.props.rundownBaselineAdLibs ?
		this.props.rundownBaselineAdLibs.concat(_.flatten(this.props.uiSegments.map(seg => seg.pieces))).filter((item) => matchFilter(item, this.props.showStyleBase, this.props.uiSegments, this.props.filter))[this.props.adlibRank ? this.props.adlibRank : 0] : undefined
		return <div className='multiview-panel'
			style={
				_.extend(
					RundownLayoutsAPI.isDashboardLayout(this.props.layout) ?
						dashboardElementPosition(this.props.panel as DashboardLayoutMultiView) :
						{},
					{
						'visibility': this.props.visible ? 'visible' : 'hidden'
					}
				)
			}>
			<div className={classNames('multiview-panel__image-container', {
				'next': piece && this.isAdLibNext(piece),
				'on-air': piece && this.isAdLibOnAir(piece)
			})} >
				<div className='multiview-panel__button'
					onClick={(e) => this.onAction(e, piece)}
				>
					{
					<span className={classNames('multiview-panel__label',{
						'multiview-panel__label--large': isLarge
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


export const MultiViewPanel = translateWithTracker<Translated<IAdLibPanelProps & IMultiViewPanelProps>, IState, IAdLibPanelTrackedProps & IMultiViewPanelTrackedProps>((props: Translated<IAdLibPanelProps>) => {
	return Object.assign({}, fetchAndFilter(props), {
		studio: props.rundown.getStudio(),
		unfinishedPieces: getUnfinishedPiecesReactive(props.rundown._id, props.rundown.currentPartId),
		nextPieces: getNextPiecesReactive(props.rundown._id, props.rundown.nextPartId)
	})
}, (data, props: IAdLibPanelProps, nextProps: IAdLibPanelProps) => {
	return !_.isEqual(props, nextProps)
})(MultiViewPanelInner)
