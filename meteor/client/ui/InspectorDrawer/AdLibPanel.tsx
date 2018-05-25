import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as _ from 'underscore'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { translate, InjectedTranslateProps } from 'react-i18next'
import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { Segment, Segments } from '../../../lib/collections/Segments'
import { SegmentLine, SegmentLines } from '../../../lib/collections/SegmentLines'
import { SegmentLineAdLibItem } from '../../../lib/collections/SegmentLineAdLibItems'
import * as ClassNames from 'classnames'

import * as faTh from '@fortawesome/fontawesome-free-solid/faTh'
import * as faList from '@fortawesome/fontawesome-free-solid/faList'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

import { Spinner } from '../../lib/Spinner'

interface IListViewPropsHeader {
	segments: Array<SegmentUi>
}

const AdLibListView = translate()(class extends React.Component<IListViewPropsHeader & InjectedTranslateProps> {
	renderSegments () {
		return this.props.segments.map((seg) => {
			return (
				<tbody key={seg._id} className={ClassNames('adlib-panel__list-view__list__segment', {
					'live': seg.isLive,
					'next': seg.isNext && !seg.isLive,
					'past': seg.segLines.reduce((memo, item) => { return item.startedPlayback && item.duration ? memo : false }, true) === true
				})}>
					<tr>
						<td className='adlib-panel__list-view__list__seg-header' colSpan={9}>
							{seg.name}
						</td>
					</tr>
					{
						seg.items && seg.items.map((item) => {
							return (
								<tr key={item._id}>
									<td className='adlib-panel__list-view__list__table__cell--icon'>
										VB
									</td>
									<td className='adlib-panel__list-view__list__table__cell--shortcut'>
										A
									</td>
									<td className='adlib-panel__list-view__list__table__cell--output'>
										PGM
									</td>
									<td className='adlib-panel__list-view__list__table__cell--name'>
										Live Strap DK
									</td>
									<td className='adlib-panel__list-view__list__table__cell--data'>
										Byen na
									</td>
									<td className='adlib-panel__list-view__list__table__cell--resolution'>
										&nbsp;
									</td>
									<td className='adlib-panel__list-view__list__table__cell--fps'>
										&nbsp;
									</td>
									<td className='adlib-panel__list-view__list__table__cell--duration'>
										&nbsp;
									</td>
									<td className='adlib-panel__list-view__list__table__cell--tc-start'>
										&nbsp;
									</td>
								</tr>
							)
						})
					}
				</tbody>
			)
		})
	}
	render () {
		const { t } = this.props

		return (
			<div className='adlib-panel__list-view__list'>
				<table className='adlib-panel__list-view__list__table'>
					<thead>
						<tr>
							<th className='adlib-panel__list-view__list__table__cell--icon'>&nbsp;</th>
							<th className='adlib-panel__list-view__list__table__cell--shortcut'>{t('Key')}</th>
							<th className='adlib-panel__list-view__list__table__cell--output'>{t('Output')}</th>
							<th className='adlib-panel__list-view__list__table__cell--name'>{t('Name')}</th>
							<th className='adlib-panel__list-view__list__table__cell--data'>{t('Data')}</th>
							<th className='adlib-panel__list-view__list__table__cell--resolution'>{t('Resolution')}</th>
							<th className='adlib-panel__list-view__list__table__cell--fps'>{t('FPS')}</th>
							<th className='adlib-panel__list-view__list__table__cell--duration'>{t('Duration')}</th>
							<th className='adlib-panel__list-view__list__table__cell--tc-start'>{t('TC Start')}</th>
						</tr>
					</thead>
					{this.renderSegments()}
				</table>
			</div>
		)
	}
})

interface IToolbarPropsHeader {
	onFilterChange?: (newFilter: string | undefined) => void
}

const AdLibPanelToolbar = translate()(class extends React.Component<IToolbarPropsHeader & InjectedTranslateProps> {
	searchInput: HTMLInputElement

	setSearchInputRef = (el: HTMLInputElement) => {
		this.searchInput = el
	}

	searchInputChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
		console.log(this.searchInput.value)
	}

	render () {
		const { t } = this.props
		return (
			<div className='adlib-panel__list-view__toolbar'>
				<div className='adlib-panel__list-view__toolbar__filter'>
					<input className='adlib-panel__list-view__toolbar__filter__input' type='text'
						   ref={this.setSearchInputRef}
						   placeholder={t('Search...')}
						   onChange={this.searchInputChanged} />
				</div>
				<div className='adlib-panel__list-view__toolbar__buttons'>
					<button className='action-btn'>
						<FontAwesomeIcon icon={faList} />
					</button>
					<button className='action-btn'>
						<FontAwesomeIcon icon={faTh} />
					</button>
				</div>
			</div>
		)
	}
})

export interface SegmentUi extends Segment {
	/** Segment line items belonging to this segment line */
	segLines: Array<SegmentLine>
	items?: Array<SegmentLineAdLibItem>
	isLive: boolean
	isNext: boolean
}

interface IPropsHeader {
	runningOrder: RunningOrder
	segments: Array<SegmentUi>
}

export const AdLibPanel = translate()(withTracker((props, state) => {
	let subSegments = Meteor.subscribe('segments', {})
	let subSegmentLines = Meteor.subscribe('segmentLines', {})
	let subSegmentLineItems = Meteor.subscribe('segmentLineAdLibItems', {})
	let subStudioInstallations = Meteor.subscribe('studioInstallations', {})
	let subShowStyles = Meteor.subscribe('showStyles', {})

	const segments = props.runningOrder && props.segments ? (props.segments as Array<SegmentUi>).map((segSource) => {
		const seg = _.clone(segSource)
		seg.segLines = segSource.getSegmentLines()
		let segmentAdLibItems: Array<SegmentLineAdLibItem> = []
		seg.segLines.forEach((segLine) => {
			if (segLine._id === props.runningOrder.currentSegmentLineId) {
				seg.isLive = true
			}
			if (segLine._id === props.runningOrder.nextSegmentLineId) {
				seg.isNext = true
			}
			segmentAdLibItems = segmentAdLibItems.concat(segLine.getSegmentLinesAdLibItems())
		})
		seg.items = segmentAdLibItems
		return seg
	}) : []

	return {
		segments
	}
})(class AdLibPanel extends React.Component<IPropsHeader> {
	renderSegmentList () {
		return this.props.segments.map((item) => {
			return (
				<div className={ClassNames('adlib-panel__segments__segment', {
					'live': item.isLive,
					'next': item.isNext && !item.isLive,
					'past': item.segLines.reduce((memo, item) => { return item.startedPlayback && item.duration ? memo : false }, true) === true
				})} key={item._id} tabIndex={0}>
					{item.name}
				</div>
			)
		})
	}

	renderListView () {
		return (
			<React.Fragment>
				<AdLibPanelToolbar />
				<AdLibListView segments={this.props.segments} />
			</React.Fragment>
		)
	}

	render () {
		if (!this.props.segments || !this.props.runningOrder) {
			return <Spinner />
		} else {
			return (
				<div className='adlib-panel super-dark'>
					<div className='adlib-panel__segments'>
						{this.renderSegmentList()}
					</div>
					{this.renderListView()}
				</div>
			)
		}
	}
}))
