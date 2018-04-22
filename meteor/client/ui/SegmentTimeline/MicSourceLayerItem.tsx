import * as React from 'react'
import * as ReactDOM from 'react-dom'

import { ISourceLayerUi, IOutputLayerUi, SegmentUi, SegmentLineUi, SegmentLineItemUi } from './SegmentTimelineContainer'

import { FloatingInspector } from '../FloatingInspector'

import * as ClassNames from 'classnames'

interface ISourceLayerItemProps {
	layer: ISourceLayerUi
	outputLayer: IOutputLayerUi
	segment: SegmentUi
	segmentLine: SegmentLineUi
	segmentLineItem: SegmentLineItemUi
	timeScale: number
	onFollowLiveLine?: (state: boolean, event: any) => void
	relative?: boolean
	totalSegmentLineDuration?: number
	followLiveLine: boolean
	liveLineHistorySize: number
	livePosition: number | null
	showMiniInspector: boolean
	itemElement: HTMLDivElement
	elementPosition: JQueryCoordinates
}
export class MicSourceLayerItem extends React.Component<ISourceLayerItemProps> {
	render () {
		return [
			<span className='segment-timeline__layer-item__label bold'>
				{this.props.segmentLineItem.name}
			</span>,
			<FloatingInspector shown={this.props.showMiniInspector && this.props.itemElement !== undefined}>
				<div className='segment-timeline__mini-inspector' style={{
					'left': this.props.elementPosition.left + 'px',
					'top': this.props.elementPosition.top + 'px'
				}}>
					This is a Mic
				</div>
			</FloatingInspector>
		]
	}
}
