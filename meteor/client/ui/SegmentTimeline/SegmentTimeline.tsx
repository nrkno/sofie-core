import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'

import * as ClassNames from 'classnames'
import Moment from 'react-moment'
import * as _ from 'underscore'

import { Segment, Segments } from '../../../lib/collections/Segments'
import { SegmentLine, SegmentLines } from '../../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../../lib/collections/SegmentLineItems'
import { StudioInstallation, StudioInstallations } from '../../../lib/collections/StudioInstallations'
import { SegmentUi, SegmentLineUi, IOutputLayerUi, ISourceLayerUi } from './SegmentTimelineContainer'

interface ISourceLayerProps {
	layer: ISourceLayerUi
	outputLayer: IOutputLayerUi
	segment: SegmentUi
	segmentLine: SegmentLineUi
}
class SourceLayer extends React.Component<ISourceLayerProps> {
	renderInside () {
		if (this.props.layer.items !== undefined) {
			return this.props.layer.items.map((segmentLineItem) => {
				if (segmentLineItem.segmentLineId === this.props.segmentLine._id) {
					return (
						<div key={segmentLineItem._id} className='segment-timeline__layer-item'>
							{segmentLineItem.name}
						</div>
					)
				}
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
}
class OutputGroup extends React.Component<IOutputGroupProps> {
	renderInside () {
		if (this.props.layer.sourceLayers !== undefined) {
			return this.props.layer.sourceLayers.map((sourceLayer) => {
				return <SourceLayer key={sourceLayer._id}
									layer={sourceLayer}
									outputLayer={this.props.layer}
									segment={this.props.segment}
									segmentLine={this.props.segmentLine} />
			})
		}
	}

	render () {
		return (
			<div className='segment-timeline__output-group'>
				{this.renderInside()}
			</div>
		)
	}
}

interface IPropsHeader {
	key: string,
	segment: SegmentUi,
	studioInstallation: StudioInstallation,
	segmentLines: Array<SegmentLineUi>
}
export class SegmentTimeline extends React.Component<IPropsHeader> {
	renderTimelineOutputGroups (segmentLine: SegmentLineUi) {
		if (this.props.segment.outputLayers !== undefined) {
			return _.map(this.props.segment.outputLayers, (layer, id) => {
				return (
					<OutputGroup key={layer._id} layer={layer} segment={this.props.segment} segmentLine={segmentLine} />
				)
			})
		}
	}

	renderTimeline () {
		return this.props.segmentLines.map((segmentLine) => {
			return (
				<div key={segmentLine._id} className='segment-timeline__segment-line'>
					{this.renderTimelineOutputGroups(segmentLine)}
				</div>
			)
		})
	}

	renderOutputLayerControls () {
		return (
			<div></div>
		)
	}

	render () {
		return (
			<div className='segment-timeline'>
				<h2 className='segment-timeline__title'>{this.props.segment.name}</h2>
				<div className='segment-timeline__mos-id'>{this.props.segment.mosId}</div>
				<div className='segment-timeline__output-layers'>
					{this.renderOutputLayerControls()}
				</div>
				<div className='segment-timeline__timeline'>
					{this.renderTimeline()}
				</div>
			</div>
		)
	}
}
