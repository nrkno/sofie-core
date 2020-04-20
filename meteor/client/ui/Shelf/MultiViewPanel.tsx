import * as React from 'react'
import * as _ from 'underscore'
import { RundownLayoutBase, RundownLayoutMultiView, DashboardLayoutMultiView, RundownLayoutMultiViewRole, RundownLayoutElementType, PieceDisplayStyle } from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { dashboardElementPosition, getUnfinishedPieceInstancesReactive } from './DashboardPanel'
import { Rundown, RundownId } from '../../../lib/collections/Rundowns'
import * as classNames from 'classnames'
import { AdLibPieceUi, IAdLibPanelProps, IAdLibPanelTrackedProps, fetchAndFilter } from './AdLibPanel'
import { doUserAction } from '../../lib/userAction'
import { translateWithTracker, Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications'
import { unprotectString } from '../../../lib/lib'
import { PartInstanceId } from '../../../lib/collections/PartInstances'
import { PieceInstances, PieceInstance, PieceInstanceId } from '../../../lib/collections/PieceInstances'
import { MeteorCall } from '../../../lib/api/methods'
import { PieceId } from '../../../lib/collections/Pieces'

interface IState {
}

interface IMultiViewPanelProps {
	layout: RundownLayoutBase
	panel: RundownLayoutMultiView
	visible: boolean
	adlibRank?: number
}

interface IMultiViewPanelTrackedProps {
	unfinishedPieces: {
		[key: string]: PieceInstanceId[]
	}
	nextPieces: {
		[key: string]: PieceInstanceId[]
	}
}

export class MultiViewPanelInner extends MeteorReactComponent<Translated<IAdLibPanelProps & IMultiViewPanelProps & IAdLibPanelTrackedProps & IMultiViewPanelTrackedProps>, IState> {

	constructor (props: Translated<IAdLibPanelProps & IAdLibPanelTrackedProps>) {
		super(props)

	}

	isAdLibOnAir (adLib: AdLibPieceUi) {
		if (this.props.unfinishedPieces[unprotectString(adLib._id)] && this.props.unfinishedPieces[unprotectString(adLib._id)].length > 0) {
			return true
		}
		return false
	}

	isAdLibNext (adLib: AdLibPieceUi) {
		if (this.props.nextPieces[unprotectString(adLib._id)] && this.props.nextPieces[unprotectString(adLib._id)].length > 0) {
			return true
		}
		return false
	}

	onToggleSticky = (sourceLayerId: string, e: any) => {
		if (this.props.playlist && this.props.playlist.currentPartInstanceId && this.props.playlist.active) {
			const { t } = this.props
			doUserAction(t, e, 'Start Sticky Piece', (e) => MeteorCall.userAction.sourceLayerStickyPieceStart(e,
				this.props.playlist._id, sourceLayerId
			))
		}
	}

	toggleAdLib (e: any, piece?: AdLibPieceUi) {
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

		const currentPartInstanceId = this.props.playlist.currentPartInstanceId

		if (!this.isAdLibOnAir(piece) && this.props.playlist && currentPartInstanceId) {
			if (!piece.isGlobal) {
				doUserAction(t, e, 'Start Adlib', (e) => MeteorCall.userAction.segmentAdLibPieceStart(e,
					this.props.playlist._id, currentPartInstanceId, piece._id, true
				))
			} else if (piece.isGlobal && !piece.isSticky) {
				doUserAction(t, e, 'Start global Adlib', (e) => MeteorCall.userAction.baselineAdLibPieceStart(e,
					this.props.playlist._id, currentPartInstanceId, piece._id, true
				))
			} else if (piece.isSticky) {
				this.onToggleSticky(piece.sourceLayerId, e)
			}
		}
	}

	take = (e: any) => {
		const { t } = this.props
		if (this.props.studioMode) {
			doUserAction(t, e, 'Take', (e) => MeteorCall.userAction.take(e, this.props.playlist._id))
		}
	}

	onAction = (e: any, piece?: AdLibPieceUi) => {
		switch (this.props.panel.role) {
			case RundownLayoutMultiViewRole.QUEUE:
				this.toggleAdLib(e, piece)
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
		const piece = this.props.panel.tags && this.props.rundownBaselineAdLibs
		.concat(_.flatten(this.props.uiSegments.map(seg => seg.pieces)))[this.props.adlibRank ? this.props.adlibRank : 0]
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


export function getNextPiecesReactive (nextPartInstanceId: PartInstanceId | null): { [adlib: string]: PieceInstanceId[] } {
	let prospectivePieceInstances: PieceInstance[] = []
	if (nextPartInstanceId) {
		prospectivePieceInstances = PieceInstances.find({
			partInstanceId: nextPartInstanceId,
			$and: [
				{
					piece: {
						$exists: true
					}
				},
				{
					'piece.adLibSourceId': {
						$exists: true
					}
				}
			]
		}).fetch()
	}

	const nextPieces: { [adlib: string]: PieceInstanceId[] } = {}
	_.each(_.groupBy(prospectivePieceInstances, (piece) => piece.piece.adLibSourceId), (grp, id) => nextPieces[id] = _.map(grp, instance => instance._id))
	return nextPieces
}

export const MultiViewPanel = translateWithTracker<Translated<IAdLibPanelProps & IMultiViewPanelProps>, IState, IAdLibPanelTrackedProps & IMultiViewPanelTrackedProps>((props: Translated<IAdLibPanelProps & IMultiViewPanelProps>) => {
	return Object.assign({}, fetchAndFilter(props), {
		studio: props.playlist.getStudio(),
		unfinishedPieces: getUnfinishedPieceInstancesReactive(props.playlist.currentPartInstanceId),
		nextPieces: getNextPiecesReactive(props.playlist.nextPartInstanceId)
	})
}, (data, props: IAdLibPanelProps, nextProps: IAdLibPanelProps) => {
	return !_.isEqual(props, nextProps)
})(MultiViewPanelInner)
