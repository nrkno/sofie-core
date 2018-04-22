import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { translate, InjectedTranslateProps } from 'react-i18next'

import * as ClassNames from 'classnames'
import * as _ from 'underscore'
import * as $ from 'jquery'

import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { Segment, Segments } from '../../../lib/collections/Segments'
import { SegmentLine, SegmentLines } from '../../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../../lib/collections/SegmentLineItems'
import { StudioInstallation, StudioInstallations } from '../../../lib/collections/StudioInstallations'
import { SegmentUi, SegmentLineUi, IOutputLayerUi, ISourceLayerUi, SegmentLineItemUi } from './SegmentTimelineContainer'
import { TimelineGrid } from './TimelineGrid'
import { SourceLayerItemContainer } from './SourceLayerItemContainer'

import { RundownUtils } from '../../lib/rundown'

interface ISourceLayerProps {
	key: string
	layer: ISourceLayerUi
	outputLayer: IOutputLayerUi
	segment: SegmentUi
	segmentLine: SegmentLineUi
	timeScale: number
	isLiveLine: boolean
	isNextLine: boolean
	onFollowLiveLine?: (state: boolean, event: any) => void
	relative?: boolean
	totalSegmentDuration?: number
	followLiveLine: boolean
	liveLineHistorySize: number
	livePosition: number
}
class SourceLayer extends React.Component<ISourceLayerProps> {
	renderInside () {
		if (this.props.layer.items !== undefined) {
			return this.props.layer.items
				.filter((segmentLineItem) => {
					// filter only segment line items belonging to this segment line
					return (segmentLineItem.segmentLineId === this.props.segmentLine._id) ? true : false
				})
				.map((segmentLineItem) => {
					return (
						<SourceLayerItemContainer key={segmentLineItem._id}
							{...this.props}
							segmentLineItem={segmentLineItem}
							layer={this.props.layer}
							outputLayer={this.props.outputLayer}
							segment={this.props.segment}
							segmentLine={this.props.segmentLine}
							timeScale={this.props.timeScale}
							relative={this.props.relative}
							totalSegmentLineDuration={this.props.relative ? (this.props.segmentLine.renderedDuration || 0) : undefined}
							lineStartsAt={this.props.segmentLine.startsAt}
							/>
					)
				})
		}
	}

	render () {
		return (
			<div className='segment-timeline__layer'>
				{this.renderInside()}
			</div>
		)
	}
}

interface IOutputGroupProps {
	layer: IOutputLayerUi
	segment: SegmentUi
	segmentLine: SegmentLineUi
	timeScale: number
	collapsedOutputs: {
		[key: string]: boolean
	}
	isLiveLine: boolean
	isNextLine: boolean
	onFollowLiveLine?: (state: boolean, event: any) => void
	followLiveLine: boolean
	liveLineHistorySize: number
	livePosition: number
}
class OutputGroup extends React.Component<IOutputGroupProps> {
	renderInside () {
		if (this.props.layer.sourceLayers !== undefined) {
			return this.props.layer.sourceLayers.map((sourceLayer) => {
				return <SourceLayer key={sourceLayer._id}
					{...this.props}
					layer={sourceLayer}
					outputLayer={this.props.layer}
					segment={this.props.segment}
					segmentLine={this.props.segmentLine}
					timeScale={this.props.timeScale} />
			})
		}
	}

	render () {
		return (
			<div className={ClassNames('segment-timeline__output-group', {
				'collapsable': this.props.layer.sourceLayers && this.props.layer.sourceLayers.length > 1,
				'collapsed': this.props.collapsedOutputs[this.props.layer._id] === true
			})}>
				{this.renderInside()}
			</div>
		)
	}
}

interface IPropsHeader {
	segment: SegmentUi
	runningOrder: RunningOrder,
	studioInstallation: StudioInstallation
	segmentLine: SegmentLineUi
	timeScale: number
	onCollapseOutputToggle?: (layer: IOutputLayerUi, event: any) => void
	collapsedOutputs: {
		[key: string]: boolean
	},
	onCollapseSegmentToggle?: (event: any) => void,
	isCollapsed?: boolean,
	scrollLeft: number,
	onScroll?: (scrollLeft: number, event: any) => void
	onFollowLiveLine?: (state: boolean, event: any) => void
	followLiveLine: boolean
	liveLineHistorySize: number
	livePosition: number | null
	relative?: boolean
	totalSegmentDuration?: number
}

export const SegmentTimelineLine = translate()(class extends React.Component<IPropsHeader & InjectedTranslateProps> {
	getLayerStyle () {
		if (this.props.relative) {
			return {
				width: ((this.props.segmentLine.renderedDuration || 0) / (this.props.totalSegmentDuration || 1) * 100).toString() + '%'
			}
		} else {
			return {
				minWidth: ((this.props.segmentLine.renderedDuration || 0) * this.props.timeScale).toString() + 'px'
			}
		}
	}

	renderTimelineOutputGroups (segmentLine: SegmentLineUi) {
		if (this.props.segment.outputLayers !== undefined) {
			return _.map(_.filter(this.props.segment.outputLayers, (layer) => {
				return (layer.used) ? true : false
			}).sort((a, b) => {
				return a._rank - b._rank
			}), (layer, id) => {
				// Only render output layers used by the segment
				if (layer.used) {
					return (
						<OutputGroup key={layer._id}
							{...this.props}
							layer={layer}
							segment={this.props.segment}
							segmentLine={segmentLine}
							isLiveLine={this.props.runningOrder.currentSegmentLineId === segmentLine._id ? true : false}
							isNextLine={this.props.runningOrder.nextSegmentLineId === segmentLine._id ? true : false}
							timeScale={this.props.timeScale} />
					)
				}
			})
		}
	}

	render () {
		const { t } = this.props

		return (
			<div className={ClassNames('segment-timeline__segment-line', {
				'live': (this.props.runningOrder.currentSegmentLineId === this.props.segmentLine._id),
				'next': (this.props.runningOrder.nextSegmentLineId === this.props.segmentLine._id)
			})} data-mos-id={this.props.segmentLine._id}
				style={this.getLayerStyle()}
				>
				<div className='segment-timeline__segment-line__nextline'>
					<div className='segment-timeline__segment-line__nextline__label'>
						{t('Next')}
					</div>
				</div>
				{this.renderTimelineOutputGroups(this.props.segmentLine)}
			</div>
		)
	}
})
