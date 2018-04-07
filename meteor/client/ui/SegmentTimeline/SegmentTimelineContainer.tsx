import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as _ from 'underscore'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'

import { normalizeArray } from '../../lib/utils'

import { Segment, Segments } from '../../../lib/collections/Segments'
import { SegmentLine, SegmentLines } from '../../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../../lib/collections/SegmentLineItems'
import { StudioInstallation, StudioInstallations, IOutputLayer, ISourceLayer } from '../../../lib/collections/StudioInstallations'

import { SegmentTimeline } from './SegmentTimeline'

export interface SegmentUi extends Segment {
	/** Output layers available in the installation used by this segment */
	outputLayers?: {
		[key: string]: IOutputLayerUi
	}
	/** Source layers used by this segment */
	sourceLayers?: {
		[key: string]: ISourceLayerUi
	}
}
export interface SegmentLineUi extends SegmentLine {
	/** Segment line items belonging to this segment line */
	items?: Array<SegmentLineItem>
}
export interface IOutputLayerUi extends IOutputLayer {
	/** Is this output layer used in this segment */
	used?: boolean
	/** Source layers that will be used by this output layer */
	sourceLayers?: Array<ISourceLayer>,
	/** Is output layer group collapsed */
	collapsed?: boolean
}
export interface ISourceLayerUi extends ISourceLayer {
	/** Segment line items present on this source layer */
	items?: Array<SegmentLineItem>
}
export interface SegmentLineItemUi extends SegmentLineItem {
	/** Source layer that this segment line item belongs to */
	sourceLayer?: ISourceLayerUi
	/** Output layer that this segment line uses */
	outputLayer?: IOutputLayerUi
}
interface IPropsHeader {
	key: string,
	segment: SegmentUi,
	studioInstallation: StudioInstallation,
	segmentLines: Array<SegmentLine>,
	timeScale?: number
}
interface IStateHeader {
	timeScale: number,
	collapsedOutputs: {
		[key: string]: boolean
	}
}
export const SegmentTimelineContainer = withTracker((props) => {
	// console.log('PeripheralDevices',PeripheralDevices);
	// console.log('PeripheralDevices.find({}).fetch()',PeripheralDevices.find({}, { sort: { created: -1 } }).fetch());

	let segment = _.clone(props.segment)

	// fetch all the segment lines for the segment
	let segmentLines = SegmentLines.find({
		segmentId: props.segment._id
	}, { sort: { _rank: 1 } }).fetch()

	// create local deep copies of the studioInstallation outputLayers and sourceLayers so that we can store
	// items present on those layers inside and also figure out which layers are used when inside the rundown
	const outputLayers = normalizeArray<IOutputLayerUi>(props.studioInstallation.outputLayers.map((layer) => { return _.clone(layer) }), '_id')
	const sourceLayers = normalizeArray<ISourceLayerUi>(props.studioInstallation.sourceLayers.map((layer) => { return _.clone(layer) }), '_id')

	// ensure that the sourceLayers array in the segment outputLayers is created
	_.forEach(outputLayers, (outputLayer) => {
		if (_.isArray(outputLayer.sourceLayers)) {
			outputLayer.sourceLayers.length = 0
		} else {
			outputLayer.sourceLayers = new Array<ISourceLayer>()
		}
		// reset the used property, in case the output layer lost all of its contents
		outputLayer.used = false
	})

	// ensure that the items array is created
	_.forEach(sourceLayers, (sourceLayer) => {
		if (_.isArray(sourceLayer.items)) {
			sourceLayer.items.length = 0
		} else {
			sourceLayer.items = new Array<SegmentLineItem>()
		}
	})

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

			// attach the segmentLineItem to the sourceLayer in this segment
			sourceLayers[segmentLineItem.sourceLayerId].items!.push(segmentLineItem)
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
class extends React.Component<IPropsHeader, IStateHeader> {
	constructor (props) {
		super(props)

		let that = this
		this.state = {
			/** The amount of pixels representing one second */
			timeScale: props.initialTimeScale || 1,
			collapsedOutputs: {}
		}

		/* that.setState({
			timeScale: that.state.timeScale * 1.1
		}) */
	}
	onCollapseOutputToggle = (outputLayer: IOutputLayerUi) => {
		let collapsedOutputs = {...this.state.collapsedOutputs}
		collapsedOutputs[outputLayer._id] = collapsedOutputs[outputLayer._id] === true ? false : true
		this.setState({ collapsedOutputs })
	}
	render () {
		return (
			<SegmentTimeline key={this.props.segment._id} segment={this.props.segment}
							 studioInstallation={this.props.studioInstallation}
							 segmentLines={this.props.segmentLines}
							 timeScale={this.state.timeScale}
							 onCollapseOutputToggle={this.onCollapseOutputToggle}
							 collapsedOutputs={this.state.collapsedOutputs} />
		)
	}
}
)
