import { withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import * as React from 'react'
import { SegmentLineItem, SegmentLineItems } from '../../../lib/collections/SegmentLineItems'
import { StudioInstallations, ISourceLayer } from '../../../lib/collections/StudioInstallations'
import { RundownAPI } from '../../../lib/api/rundown'
import { normalizeArray } from '../../lib/utils'
import * as _ from 'underscore'

import CamInputIcon from './Renderers/CamInput'
import VTInputIcon from './Renderers/VTInput'
import SplitInputIcon from './Renderers/SplitInput'
import RemoteInputIcon from './Renderers/RemoteInput'
import LiveSpeakInputIcon from './Renderers/LiveSpeakInput'
import GraphicsInputIcon from './Renderers/GraphicsInput'

interface IPropsHeader {
	segmentItemId: string
	studioInstallationId: string
}

export const SegmentItemIconContainer = withTracker((props: IPropsHeader) => {
	// console.log(props)
	let items = SegmentLineItems.find({ segmentLineId: props.segmentItemId }).fetch()
	let studioInstallation = StudioInstallations.findOne(props.studioInstallationId)
	let sourceLayers = studioInstallation ? normalizeArray<ISourceLayer>(studioInstallation.sourceLayers.map((layer) => { return _.clone(layer) }), '_id') : {}
	let sourceLayer: ISourceLayer | undefined
	let segmentLineItem: SegmentLineItem | undefined

	for (const item of items) {
		let layer = sourceLayers[item.sourceLayerId]
		if (typeof sourceLayer !== 'undefined') {
			if (sourceLayer._rank > layer._rank) {
				sourceLayer = layer
				segmentLineItem = item
			}
		} else {
			sourceLayer = layer
			segmentLineItem = item
		}
	}

	return {
		sourceLayer,
		segmentLineItem
	}
})(class extends MeteorReactComponent<IPropsHeader & { sourceLayer: ISourceLayer, segmentLineItem: SegmentLineItem }> {
	render () {
		if (this.props.sourceLayer) {
			switch (this.props.sourceLayer.type) {
				case RundownAPI.SourceLayerType.GRAPHICS :
					return (
						<GraphicsInputIcon abbreviation={this.props.sourceLayer.abbreviation} />
					)
				case RundownAPI.SourceLayerType.LIVE_SPEAK :
					return (
						<LiveSpeakInputIcon abbreviation={this.props.sourceLayer.abbreviation} />
					)
				case RundownAPI.SourceLayerType.REMOTE :
					return (
						<RemoteInputIcon inputIndex={ ((this.props.segmentLineItem || {}).content || {}).inputIndex as number } abbreviation={this.props.sourceLayer.abbreviation} />
					)
				case RundownAPI.SourceLayerType.SPLITS :
					return (
						<SplitInputIcon abbreviation={this.props.sourceLayer.abbreviation} />
					)
				case RundownAPI.SourceLayerType.VT :
					return (
						<VTInputIcon abbreviation={this.props.sourceLayer.abbreviation} />
					)
				case RundownAPI.SourceLayerType.CAMERA :
					return (
						<CamInputIcon inputIndex={ ((this.props.segmentLineItem || {}).content || {}).inputIndex as number } abbreviation={this.props.sourceLayer.abbreviation} />
					)
			}
		}
		return null
	}
})
