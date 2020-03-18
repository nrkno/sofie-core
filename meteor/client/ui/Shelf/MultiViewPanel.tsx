import * as React from 'react'
import * as _ from 'underscore'
import { RundownLayoutBase, RundownLayoutMultiView, DashboardLayoutMultiView } from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { dashboardElementPosition, getUnfinishedPiecesReactive } from './DashboardPanel'
import { Rundown } from '../../../lib/collections/Rundowns'
import * as classNames from 'classnames'
import { AdLibPieceUi, matchTags, IAdLibPanelProps, IAdLibPanelTrackedProps, fetchAndFilter } from './AdLibPanel'
import { UserActionAPI } from '../../../lib/api/userActions'
import { doUserAction } from '../../lib/userAction'
import { Studio } from '../../../lib/collections/Studios'
import { Piece } from '../../../lib/collections/Pieces'
import { translateWithTracker, Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { TranslationFunction } from 'i18next'

interface IState {
}

interface IMultiViewPanelProps {
	layout: RundownLayoutBase
	panel: RundownLayoutMultiView
	visible: boolean
	rundown: Rundown
	t: TranslationFunction // why this needs to be here?
}

interface IMultiViewPanelTrackedProps {
	studio?: Studio
	unfinishedPieces: {
		[key: string]: Piece[]
	}
}

function getImagePosition (id: number): React.CSSProperties {
	let rectangle = [
		{ x: 0.005, y: 0.0058, width: 0.49, height: 0.487 },
		{ x: 0.505, y: 0.0058, width: 0.49, height: 0.487 },
		{ x: 0.005, y: 0.5055, width: 0.24, height: 0.239 },
		{ x: 0.255, y: 0.5055, width: 0.24, height: 0.239 },
		{ x: 0.505, y: 0.5055, width: 0.24, height: 0.239 },
		{ x: 0.755, y: 0.5055, width: 0.24, height: 0.239 },
		{ x: 0.005, y: 0.7555, width: 0.24, height: 0.239 },
		{ x: 0.255, y: 0.7555, width: 0.24, height: 0.239 },
		{ x: 0.505, y: 0.7555, width: 0.24, height: 0.239 },
		{ x: 0.755, y: 0.7555, width: 0.24, height: 0.239 }
	][id - 1]
	if	(!rectangle) {
		rectangle = { x: 0, y: 0, width: 1, height: 1 }
	}
	return {
		width: (100 / rectangle.width) + '%',
		height: (100 / rectangle.height) + '%',
		top: (-100 * rectangle.y / rectangle.height) + '%',
		left: (-100 * rectangle.x / rectangle.width) + '%'
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

	onToggleAdLib (piece: AdLibPieceUi | undefined, e: any) {
		const { t } = this.props
		if (!piece) {
			return
		}
		if (!this.isAdLibOnAir(piece)) {
			// TODO: make this work as expected
			if (!piece.isGlobal) {
				doUserAction(t, e, UserActionAPI.methods.segmentAdLibPieceStart, [
					this.props.rundown._id, this.props.rundown.currentPartId, piece._id, true
				])
			} else if (piece.isGlobal && !piece.isSticky) {
				doUserAction(t, e, UserActionAPI.methods.baselineAdLibPieceStart, [
					this.props.rundown._id, this.props.rundown.currentPartId, piece._id, true
				])
			} else if (piece.isSticky) {
				// this.onToggleSticky(piece.sourceLayerId, e)
			}
		}
	}

	render () {
		const isLarge = RundownLayoutsAPI.isDashboardLayout(this.props.layout) && (this.props.panel as DashboardLayoutMultiView).width > 11
		const piece = this.props.rundownBaselineAdLibs
		.concat(_.flatten(this.props.uiSegments.map(seg => seg.pieces)))
		.filter((item) => matchTags(item, this.props.panel.tags))[0]
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
			<div className='multiview-panel__image-container' >
				<img
				className='multiview-panel__image'
				src={this.props.panel.url}
				style={getImagePosition(this.props.panel.windowNumber)}
				/>
				{!isLarge &&
					<span className={classNames('multiview-panel__label')}>{this.props.panel.name}</span>
				}
				<div className='multiview-panel__button'
					onClick={(e) => this.onToggleAdLib(piece, e)}
				></div>
			</div>
			{isLarge &&
				<span className={classNames('multiview-panel__label')}>{this.props.panel.name}</span>
			}
		</div>
	}
}

export const MultiViewPanel = translateWithTracker<IAdLibPanelProps & IMultiViewPanelProps, IState, IAdLibPanelTrackedProps & IMultiViewPanelTrackedProps>((props: Translated<IAdLibPanelProps>) => {
	return Object.assign({}, fetchAndFilter(props), {
		studio: props.rundown.getStudio(),
		unfinishedPieces: getUnfinishedPiecesReactive(props.rundown._id, props.rundown.currentPartId)
	})
}, (data, props: IAdLibPanelProps, nextProps: IAdLibPanelProps) => {
	return !_.isEqual(props, nextProps)
})(MultiViewPanelInner)
