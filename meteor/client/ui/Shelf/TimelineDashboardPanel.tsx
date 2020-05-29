import * as React from 'react'
import * as _ from 'underscore'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import ClassNames from 'classnames'


import { Spinner } from '../../lib/Spinner'
import { IOutputLayer, ISourceLayer } from 'tv-automation-sofie-blueprints-integration'
import { DashboardLayoutFilter } from '../../../lib/collections/RundownLayouts'
import { IAdLibPanelProps, IAdLibPanelTrackedProps, fetchAndFilter, AdLibPieceUi, matchFilter, AdLibPanelToolbar } from './AdLibPanel'
import { DashboardPieceButton } from './DashboardPieceButton'
import { ensureHasTrailingSlash } from '../../lib/lib'
import { Studio } from '../../../lib/collections/Studios'
import { DashboardPanelInner, dashboardElementPosition, getUnfinishedPieceInstancesReactive } from './DashboardPanel'
import { PieceInstanceId } from '../../../lib/collections/PieceInstances'
import { unprotectString, protectString } from '../../../lib/lib'
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
}

interface IDashboardPanelTrackedProps {
	studio?: Studio
	unfinishedPieceInstanceIds: {
		[adlibId: string]: PieceInstanceId[]
	}
}

export const TimelineDashboardPanel = translateWithTracker<IAdLibPanelProps & IDashboardPanelProps, IState, IAdLibPanelTrackedProps & IDashboardPanelTrackedProps>((props: Translated<IAdLibPanelProps>) => {
	return{
		...fetchAndFilter(props),
		studio: props.playlist.getStudio(),
		unfinishedPieceInstanceIds: getUnfinishedPieceInstancesReactive(props.playlist.currentPartInstanceId)
	}
}, (data, props: IAdLibPanelProps, nextProps: IAdLibPanelProps) => {
	return !_.isEqual(props, nextProps)
})(class TimelineDashboardPanel extends DashboardPanelInner {
	liveLine: HTMLDivElement
	scrollIntoViewTimeout: NodeJS.Timer | undefined = undefined
	setRef = (el: HTMLDivElement) => {
		this.liveLine = el
		this.ensureLiveLineVisible()
	}
	componentDidUpdate (prevProps) {
		super.componentDidUpdate(prevProps)
		this.ensureLiveLineVisible()
	}
	componentDidMount () {
		super.componentDidMount()
		this.ensureLiveLineVisible()
	}
	ensureLiveLineVisible = _.debounce(() => {
		if (this.liveLine) {
			this.liveLine.scrollIntoView({
				behavior: 'smooth',
				block: 'start',
				inline: 'start'
			})
		}
	}, 250)
	render () {
		if (this.props.visible && this.props.showStyleBase && this.props.filter) {
			const filter = this.props.filter as DashboardLayoutFilter
			if (!this.props.uiSegments || !this.props.playlist) {
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
						<div className={ClassNames('dashboard-panel__panel', {
							'dashboard-panel__panel--horizontal': filter.overflowHorizontally
						})}>
							{filteredRudownBaselineAdLibs.length > 0 &&
								<div className='dashboard-panel__panel__group'>
									{filteredRudownBaselineAdLibs.map((item: AdLibPieceUi) => {
										return <DashboardPieceButton
													key={unprotectString(item._id)}
													adLibListItem={item}
													layer={this.state.sourceLayers[item.sourceLayerId]}
													outputLayer={this.state.outputLayers[item.outputLayerId]}
													onToggleAdLib={this.onToggleAdLib}
													playlist={this.props.playlist}
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

								return filteredPieces.length > 0 || seg.isLive || (seg.isNext && !this.props.playlist.currentPartInstanceId) ?
									<div key={unprotectString(seg._id)}
										id={'dashboard-panel__panel__group__' + seg._id}
										className={ClassNames('dashboard-panel__panel__group', {
											'live': seg.isLive,
											'next': (seg.isNext && !this.props.playlist.currentPartInstanceId)
										})}>
										{(seg.isLive || (seg.isNext && !this.props.playlist.currentPartInstanceId)) &&
											<div className='dashboard-panel__panel__group__liveline' ref={this.setRef}></div>
										}
										{filteredPieces.map((item: AdLibPieceUi) => {
											return <DashboardPieceButton
														key={unprotectString(item._id)}
														adLibListItem={item}
														layer={this.state.sourceLayers[item.sourceLayerId]}
														outputLayer={this.state.outputLayers[item.outputLayerId]}
														onToggleAdLib={this.onToggleAdLib}
														playlist={this.props.playlist}
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
