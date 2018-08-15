import * as React from 'react'

import * as ClassNames from 'classnames'
import * as _ from 'underscore'

import { RunningOrder } from '../../../lib/collections/RunningOrders'

import { SegmentLineUi, IOutputLayerUi, ISourceLayerUi, SegmentLineItemUi } from './SegmentTimelineContainer'
import { SourceLayerItemContainer } from './SourceLayerItemContainer'
import { ErrorBoundary } from '../../lib/ErrorBoundary'

interface IProps {
	runningOrder: RunningOrder
	segmentLine?: SegmentLineUi
	outputGroups?: {
		[key: string]: IOutputLayerUi
	},
	sourceLayers?: {
		[key: string]: ISourceLayerUi
	},
	collapsedOutputs: {
		[key: string]: boolean
	},
	isCollapsed?: boolean
}

export const SegmentNextPreview = class extends React.Component<IProps> {
	renderSourceLayers (outputLayer: IOutputLayerUi, layers: ISourceLayerUi[] | undefined) {
		if (layers) {
			return layers.filter(i => !i.isHidden).map((layer, id) => {
				return (
					<div className='segment-timeline__layer' key={id}>
						{layer.followingItems && layer.followingItems
							.filter((segmentLineItem) => {
								// filter only segment line items belonging to this segment line
								return this.props.segmentLine && ((segmentLineItem.segmentLineId === this.props.segmentLine._id) ?
									// filter only segment line items, that have not yet been linked to parent items
									((segmentLineItem as SegmentLineItemUi).linked !== true) ?
										true :
										// (this.props.scrollLeft >= ((this.props.segmentLine.startsAt || 0) + ((segmentLineItem as SegmentLineItemUi).renderedInPoint || 0)))
										true
									: false)
							})
							.map((segmentLineItem) => {
								return this.props.segmentLine && (
									<SourceLayerItemContainer key={segmentLineItem._id}
										{...this.props}
										// The following code is fine, just withTracker HOC messing with available props
										isLiveLine={false}
										isNextLine={false}
										outputGroupCollapsed={this.props.collapsedOutputs[outputLayer._id] === true}
										followLiveLine={false}
										liveLineHistorySize={0}
										livePosition={0}
										runningOrder={this.props.runningOrder}
										segmentLineItem={segmentLineItem}
										layer={layer}
										outputLayer={outputLayer}
										segmentLine={this.props.segmentLine}
										segmentLineStartsAt={0}
										segmentLineDuration={1}
										timeScale={1}
										relative={true}
										autoNextSegmentLine={false}
										liveLinePadding={0}
										scrollLeft={0}
										scrollWidth={1}
										mediaPreviewUrl=''
									/>
								)
							})}
					</div>
				)
			})
		} else {
			return null
		}
	}
	renderOutputGroups () {
		if (this.props.outputGroups) {
			return (
				_.map(_.filter(this.props.outputGroups, (layer) => {
					return (layer.used) ? true : false
				}).sort((a, b) => {
					return a._rank - b._rank
				}), (layer, id) => {
					return (
						<div className={ClassNames('segment-timeline__output-group', {
							'collapsable': layer.sourceLayers && layer.sourceLayers.length > 1,
							'collapsed': this.props.collapsedOutputs[layer._id] === true
						})} key={id}>
							{this.renderSourceLayers(layer, layer.sourceLayers)}
						</div>
					)
				})
			)
		} else {
			return null
		}
	}
	renderSegmentLine () {
		return (
			<div className='segment-timeline__segment-line' data-mos-id={this.props.segmentLine ? this.props.segmentLine._id : '(NONE)'}>
				{this.renderOutputGroups()}
			</div>
		)
	}
	render () {
		return <React.Fragment>
			<div className='segment-timeline__next-preview'>
				{this.props.segmentLine && this.renderSegmentLine()}
			</div>
			<div className='segment-timeline__next-preview-background'>
			</div>
		</React.Fragment>
	}
}
