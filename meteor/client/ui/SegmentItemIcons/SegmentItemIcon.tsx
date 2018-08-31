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
	runningOrderId: string
	studioInstallationId: string
}

export const SegmentItemIconContainer = withTracker((props: IPropsHeader) => {
	// console.log(props)
	let items = SegmentLineItems.find({ segmentLineId: props.segmentItemId }).fetch()
	let studioInstallation = StudioInstallations.findOne(props.studioInstallationId)
	let sourceLayers = studioInstallation ? normalizeArray<ISourceLayer>(studioInstallation.sourceLayers.map((layer) => { return _.clone(layer) }), '_id') : {}
	let sourceLayer: ISourceLayer | undefined
	let segmentLineItem: SegmentLineItem | undefined
	const supportedLayers = new Set([ RundownAPI.SourceLayerType.GRAPHICS, RundownAPI.SourceLayerType.LIVE_SPEAK, RundownAPI.SourceLayerType.REMOTE, RundownAPI.SourceLayerType.SPLITS, RundownAPI.SourceLayerType.VT, RundownAPI.SourceLayerType.CAMERA ])

	for (const item of items) {
		let layer = sourceLayers[item.sourceLayerId]
		if (!layer) continue
		if (typeof sourceLayer !== 'undefined' && typeof segmentLineItem !== 'undefined') {
			if (sourceLayer._rank >= layer._rank && supportedLayers.has(layer.type)) {
				sourceLayer = layer
				if (segmentLineItem.trigger && item.trigger && item.trigger.value > segmentLineItem.trigger.value) {
					segmentLineItem = item
				}
			}
		} else if (supportedLayers.has(layer.type)) {
			sourceLayer = layer
			segmentLineItem = item
		}
	}

	return {
		sourceLayer,
		segmentLineItem
	}
})(class extends MeteorReactComponent<IPropsHeader & { sourceLayer: ISourceLayer, segmentLineItem: SegmentLineItem }> {
	_segmentLineItemSubscription: Meteor.SubscriptionHandle

	componentWillMount () {
		this.subscribe('segmentLineItemsSimple', {
			runningOrderId: this.props.runningOrderId
		})
		this.subscribe('studioInstallations', {
			_id: this.props.studioInstallationId
		})
	}

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
						<RemoteInputIcon inputIndex={ parseInt(((this.props.segmentLineItem || {}).name.toString()).split(' ').slice(-1)[0], 10) as number } abbreviation={this.props.sourceLayer.abbreviation} />
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
						<CamInputIcon inputIndex={ parseInt(((this.props.segmentLineItem || {}).name.toString()).split(' ').slice(-1)[0], 10) as number } abbreviation={this.props.sourceLayer.abbreviation} />
					)
			}
		}
		return null
	}
})
