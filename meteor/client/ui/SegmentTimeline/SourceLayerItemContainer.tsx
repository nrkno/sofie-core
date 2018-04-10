import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as _ from 'underscore'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'

import { SourceLayerItem } from './SourceLayerItem'

import {
	ISourceLayerUi,
	IOutputLayerUi,
	SegmentUi,
	SegmentLineUi,
	SegmentLineItemUi
} from './SegmentTimelineContainer'

interface IPropsHeader {
	layer: ISourceLayerUi
	outputLayer: IOutputLayerUi
	segment: SegmentUi
	segmentLine: SegmentLineUi
	segmentLineItem: SegmentLineItemUi
	timeScale: number,
	isLiveLine: boolean,
	isNextLine: boolean
}
/** This is an  */
export const SourceLayerItemContainer = withTracker((props) => {
	if (props.isLiveLine) {
		// Check in Timeline collection for any changes to the related object
		return {}
	} else {
		// Don't expect any changes
		return {}
	}
})(
class extends React.Component<IPropsHeader> {
	render () {
		return (
			<SourceLayerItem {...this.props} />
		)
	}
}
)
