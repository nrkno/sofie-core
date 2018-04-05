import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as _ from 'underscore'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'

import { Segment, Segments } from '../../../lib/collections/Segments'
import { SegmentLine, SegmentLines } from '../../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../../lib/collections/SegmentLineItems'
import { StudioInstallation, StudioInstallations, IOutputLayer, ISourceLayer } from '../../../lib/collections/StudioInstallations'
import { normalizeArray } from '../../lib/utils'

import { SegmentTimeline } from './SegmentTimeline'

export interface SegmentUi extends Segment {
	outputLayers?: {
		[key: string]: IOutputLayerUi
	}
	sourceLayers?: {
		[key: string]: ISourceLayerUi
	}
}
export interface SegmentLineUi extends SegmentLine {
	items?: Array<SegmentLineItem>
}
export interface IOutputLayerUi extends IOutputLayer {
	used?: Boolean
	sourceLayers?: Array<ISourceLayer>
}
export interface ISourceLayerUi extends ISourceLayer {
	items?: Array<SegmentLineItem>
}
export interface SegmentLineItemUi extends SegmentLineItem {
	sourceLayer?: ISourceLayer
	outputLayer?: IOutputLayer
}
interface IPropsHeader {
	key: string,
	segment: SegmentUi,
	studioInstallation: StudioInstallation,
	segmentLines: Array<SegmentLine>
}
export const SegmentTimelineContainer = withTracker((props) => {
	// console.log('PeripheralDevices',PeripheralDevices);
	// console.log('PeripheralDevices.find({}).fetch()',PeripheralDevices.find({}, { sort: { created: -1 } }).fetch());

	let segment = _.clone(props.segment)

	// fetch all the segment lines for the segment
	let segmentLines = SegmentLines.find({
		segmentId: props.segment._id
	}, { sort: { _rank: 1 } }).fetch()

	// create local copies of the studioInstallation outputLayers and sourceLayers so that we can store
	const outputLayers = normalizeArray<IOutputLayerUi>(_.clone(props.studioInstallation.outputLayers), '_id')
	const sourceLayers = normalizeArray<ISourceLayerUi>(_.clone(props.studioInstallation.sourceLayers), '_id')

	// fetch all the segment line items for the segment lines
	_.forEach<SegmentLineUi>(segmentLines, (segmentLine) => {
		let segmentLineItems = SegmentLineItems.find({
			segmentLineId: segmentLine._id
		}).fetch()
		segmentLine.items = segmentLineItems

		_.forEach<SegmentLineItemUi>(segmentLine.items, (segmentLineItem) => {
			segmentLineItem.outputLayer = outputLayers[segmentLineItem.outputLayerId]
			// mark the output layer as used within this segment
			outputLayers[segmentLineItem.outputLayerId].used = true
			segmentLineItem.sourceLayer = sourceLayers[segmentLineItem.sourceLayerId]
			// ensure that the items array is created
			if (_.isArray(sourceLayers[segmentLineItem.sourceLayerId].items) === false) {
				sourceLayers[segmentLineItem.sourceLayerId].items = new Array<SegmentLineItem>()
			}
			// attach the segmentLineItem to the sourceLayer in this segment
			sourceLayers[segmentLineItem.sourceLayerId].items!.push(segmentLineItem)

			// ensure that the sourceLayers array in the segment outputLayers is created
			if (_.isArray(outputLayers[segmentLineItem.outputLayerId].sourceLayers) === false) {
				outputLayers[segmentLineItem.outputLayerId].sourceLayers = new Array<ISourceLayer>()
			}
			// attach the sourceLayer to the outputLayer, if it hasn't been already
			let index = outputLayers[segmentLineItem.outputLayerId].sourceLayers!.indexOf(segmentLineItem.sourceLayer)
			if (index < 0) {
				outputLayers[segmentLineItem.outputLayerId].sourceLayers!.push(segmentLineItem.sourceLayer)
			}
		})
	})

	segment.outputLayers = outputLayers
	segment.sourceLayers = sourceLayers

	return {
		segment,
		segmentLines
	}
})(
class extends React.Component<IPropsHeader> {
	render () {
		return (
			<SegmentTimeline key={this.props.segment._id} segment={this.props.segment}
							 studioInstallation={this.props.studioInstallation}
							 segmentLines={this.props.segmentLines} />
		)
	}
}
)
