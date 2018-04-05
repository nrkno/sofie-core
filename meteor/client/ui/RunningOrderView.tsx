import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'

import * as ClassNames from 'classnames'
import { Time } from '../../lib/lib'

import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { Segment, Segments } from '../../lib/collections/Segments'
import { SegmentTimelineContainer } from './SegmentTimeline/SegmentTimelineContainer'
import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'

interface IPropsHeader {
	key: string
	runningOrder: RunningOrder
	segments: Array<Segment>
	studioInstallation: StudioInstallation
	match: {
		runningOrderId: String
	}
}

export const RunningOrderView = withTracker((props) => {
	// console.log('PeripheralDevices',PeripheralDevices);
	// console.log('PeripheralDevices.find({}).fetch()',PeripheralDevices.find({}, { sort: { created: -1 } }).fetch());

	let subRunningOrders = Meteor.subscribe('runningOrders', {})
	let subSegments = Meteor.subscribe('segments', {})
	let subSegmentLines = Meteor.subscribe('segmentLines', {})
	let subSegmentLineItems = Meteor.subscribe('segmentLineItems', {})
	let subStudioInstallations = Meteor.subscribe('studioInstallations', {})
	let subShowStyles = Meteor.subscribe('showStyles', {})

	let runningOrder = RunningOrders.findOne({ _id: props.match.params.runningOrderId })

	return {
		runningOrder: runningOrder,
		segments: runningOrder ? Segments.find({ runningOrderId: runningOrder._id }).fetch() : undefined,
		studioInstallation: runningOrder ? StudioInstallations.findOne({ _id: runningOrder.studioInstallationId }) : undefined,
	}
})(
class extends React.Component<IPropsHeader> {
	renderSegments () {
		if (this.props.segments !== undefined && this.props.studioInstallation !== undefined) {
			return this.props.segments.map((segment) => (
				<SegmentTimelineContainer key={segment._id} studioInstallation={this.props.studioInstallation} segment={segment} />
			))
		} else {
			return (
				<div></div>
			)
		}
	}

	render () {
		if (this.props.runningOrder !== undefined) {
			return (
				<div>
					<h1>{this.props.runningOrder.name}</h1>
					{this.renderSegments()}
				</div>
			)
		} else {
			return (
				<div>
					Loading...
				</div>
			)
		}
	}
}
)
