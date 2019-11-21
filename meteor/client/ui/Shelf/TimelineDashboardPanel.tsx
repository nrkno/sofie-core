import * as React from 'react'
import * as _ from 'underscore'
import * as Velocity from 'velocity-animate'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { translate } from 'react-i18next'
import { Rundown } from '../../../lib/collections/Rundowns'
import { Segment } from '../../../lib/collections/Segments'
import { Part } from '../../../lib/collections/Parts'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { AdLibListItem } from './AdLibListItem'
import * as ClassNames from 'classnames'
import { mousetrapHelper } from '../../lib/mousetrapHelper'

import * as faTh from '@fortawesome/fontawesome-free-solid/faTh'
import * as faList from '@fortawesome/fontawesome-free-solid/faList'
import * as faTimes from '@fortawesome/fontawesome-free-solid/faTimes'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

import { Spinner } from '../../lib/Spinner'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownViewKbdShortcuts } from '../RundownView'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { IOutputLayer, ISourceLayer } from 'tv-automation-sofie-blueprints-integration'
import { PubSub, meteorSubscribe } from '../../../lib/api/pubsub'
import { doUserAction } from '../../lib/userAction'
import { UserActionAPI } from '../../../lib/api/userActions'
import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications'
import { RundownLayoutFilter, DashboardLayoutFilter } from '../../../lib/collections/RundownLayouts'
import { RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { Random } from 'meteor/random'
import { literal } from '../../../lib/lib'
import { RundownAPI } from '../../../lib/api/rundown'
import { IAdLibPanelProps, IAdLibPanelTrackedProps, fetchAndFilter, AdLibPieceUi, matchFilter, AdLibPanelToolbar } from './AdLibPanel'
import { DashboardPieceButton } from './DashboardPieceButton'
import { ensureHasTrailingSlash } from '../../lib/lib'
import { Studio } from '../../../lib/collections/Studios'
import { Piece, Pieces } from '../../../lib/collections/Pieces'
import { DashboardPanel, DashboardPanelInner } from './DashboardPanel';

interface IState {
	outputLayers: {
		[key: string]: IOutputLayer
	}
	sourceLayers: {
		[key: string]: ISourceLayer
	},
	searchFilter: string | undefined
}

interface IDashboardPanelProps {
	searchFilter?: string | undefined
	mediaPreviewUrl?: string
}

interface IDashboardPanelTrackedProps {
	studio?: Studio
	unfinishedPieces: {
		[key: string]: Piece[]
	}
}

interface DashboardPositionableElement {
	x: number
	y: number
	width: number
	height: number
}

export function dashboardElementPosition(el: DashboardPositionableElement): React.CSSProperties {
	return {
		width: el.width >= 0 ?
			`calc((${el.width} * var(--dashboard-button-grid-width)) + var(--dashboard-panel-margin-width))` :
			undefined,
		height: el.height >= 0 ?
			`calc((${el.height} * var(--dashboard-button-grid-height)) + var(--dashboard-panel-margin-height))` :
			undefined,
		left: el.x >= 0 ?
			`calc(${el.x} * var(--dashboard-button-grid-width))` :
			el.width < 0 ?
				`calc(${-1 * el.width - 1} * var(--dashboard-button-grid-width))` :
				undefined,
		top: el.y >= 0 ?
			`calc(${el.y} * var(--dashboard-button-grid-height))` :
			el.height < 0 ?
				`calc(${-1 * el.height - 1} * var(--dashboard-button-grid-height))` :
				undefined,
		right: el.x < 0 ?
			`calc(${-1 * el.x - 1} * var(--dashboard-button-grid-width))` :
			el.width < 0 ?
				`calc(${-1 * el.width - 1} * var(--dashboard-button-grid-width))` :
				undefined,
		bottom: el.y < 0 ?
			`calc(${-1 * el.y - 1} * var(--dashboard-button-grid-height))` :
			el.height < 0 ?
				`calc(${-1 * el.height - 1} * var(--dashboard-button-grid-height))` :
				undefined
	}
}

export const TimelineDashboardPanel = translateWithTracker<IAdLibPanelProps & IDashboardPanelProps, IState, IAdLibPanelTrackedProps & IDashboardPanelTrackedProps>((props: Translated<IAdLibPanelProps>) => {
	const unfinishedPieces = _.groupBy(props.rundown.currentPartId ? Pieces.find({
		rundownId: props.rundown._id,
		partId: props.rundown.currentPartId,
		startedPlayback: {
			$exists: true
		},
		$or: [{
			stoppedPlayback: {
				$eq: 0
			}
		}, {
			stoppedPlayback: {
				$exists: false
			}
		}],
		adLibSourceId: {
			$exists: true
		}
	}).fetch() : [], (piece) => piece.adLibSourceId)

	return Object.assign({}, fetchAndFilter(props), {
		studio: props.rundown.getStudio(),
		unfinishedPieces
	})
}, (data, props: IAdLibPanelProps, nextProps: IAdLibPanelProps) => {
	return !_.isEqual(props, nextProps)
})(class TimelineDashboardPanel extends DashboardPanelInner {
	liveLine: HTMLDivElement
	setRef = (el: HTMLDivElement) => {
		this.liveLine = el
	}
	componentDidUpdate (prevProps) {
		super.componentDidUpdate(prevProps)
		this.ensureLiveLineVisible()
	}
	componentDidMount () {
		super.componentDidMount()
		this.ensureLiveLineVisible()
	}
	ensureLiveLineVisible () {
		if (this.liveLine) {
			this.liveLine.scrollIntoView({
				behavior: 'smooth',
				block: 'start',
				inline: 'nearest'
			})
		}
	}
	render () {
		if (this.props.visible && this.props.showStyleBase && this.props.filter) {
			const filter = this.props.filter as DashboardLayoutFilter
			if (!this.props.uiSegments || !this.props.rundown) {
				return <Spinner />
			} else {
				const filteredRudownBaselineAdLibs = this.props.rundownBaselineAdLibs.filter((item) => matchFilter(item, this.props.showStyleBase, this.props.uiSegments, this.props.filter, this.state.searchFilter))

				return (
					<div className='dashboard-panel dashboard-panel--timeline-style'
						style={dashboardElementPosition(filter)}
					>
						<h4 className='dashboard-panel__header'>
							{this.props.filter.name}
						</h4>
						{ filter.enableSearch &&
							<AdLibPanelToolbar
								onFilterChange={this.onFilterChange} />
						}
						<div className='dashboard-panel__panel'>
							{filteredRudownBaselineAdLibs.length > 0 &&
								<div className='dashboard-panel__panel__group'>
									{filteredRudownBaselineAdLibs.map((item: AdLibPieceUi) => {
										return <DashboardPieceButton
													key={item._id}
													item={item}
													layer={this.state.sourceLayers[item.sourceLayerId]}
													outputLayer={this.state.outputLayers[item.outputLayerId]}
													onToggleAdLib={this.onToggleAdLib}
													rundown={this.props.rundown}
													isOnAir={this.isAdLibOnAir(item)}
													mediaPreviewUrl={this.props.studio ? ensureHasTrailingSlash(this.props.studio.settings.mediaPreviewsUrl + '' || '') || '' : ''}
													widthScale={filter.buttonWidthScale}
													heightScale={filter.buttonHeightScale}
												>
													{item.name}
										</DashboardPieceButton>
									})}
								</div>
							}
							{this.props.uiSegments.map((seg) => {
								const filteredPieces = seg.pieces ?
									seg.pieces.filter((item) => matchFilter(item, this.props.showStyleBase, this.props.uiSegments, this.props.filter, this.state.searchFilter)) :
									[]
								
								return filteredPieces.length > 0 || seg.isLive ?
									<div key={seg._id}
										id={'dashboard-panel__panel__group__' + seg._id}
										className={ClassNames('dashboard-panel__panel__group', {
											'live': seg.isLive
										})}>
										{seg.isLive && 
											<div className='dashboard-panel__panel__group__liveline' ref={this.setRef}></div>
										}
										{filteredPieces.map((item: AdLibPieceUi) => {
											return <DashboardPieceButton
														key={item._id}
														item={item}
														layer={this.state.sourceLayers[item.sourceLayerId]}
														outputLayer={this.state.outputLayers[item.outputLayerId]}
														onToggleAdLib={this.onToggleAdLib}
														rundown={this.props.rundown}
														isOnAir={this.isAdLibOnAir(item)}
														mediaPreviewUrl={this.props.studio ? ensureHasTrailingSlash(this.props.studio.settings.mediaPreviewsUrl + '' || '') || '' : ''}
														widthScale={filter.buttonWidthScale}
														heightScale={filter.buttonHeightScale}
													>
														{item.name}
											</DashboardPieceButton>
										})}
									</div> :
									undefined
							})}
						</div>
					</div>
				)
			}
		}
		return null
	}
})
