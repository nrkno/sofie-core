import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as _ from 'underscore'
import { ISourceLayerUi,
		 IOutputLayerUi,
		 SegmentUi,
		 SegmentLineUi,
		 SegmentLineItemUi } from './SegmentTimelineContainer'

import { RundownAPI } from './../../../lib/api/rundown'

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
}
export class SourceLayerItem extends React.Component<ISourceLayerItemProps> {
	getItemStyle (): { [key: string]: string } {
		let segmentLineItem = this.props.segmentLineItem

		if (this.props.relative) {
			return {
				// as-run "duration" takes priority over renderdDuration which takes priority over MOS-import expectedDuration (editorial duration)
				'left': ((segmentLineItem.renderedInPoint || 0) / (this.props.totalSegmentLineDuration || 1) * 100).toString() + '%',
				'width': ((segmentLineItem.duration || segmentLineItem.renderedDuration || segmentLineItem.expectedDuration) / (this.props.totalSegmentLineDuration || 1) * 100).toString() + '%'
			}
		} else {
			return {
				// as-run "duration" takes priority over renderdDuration which takes priority over MOS-import expectedDuration (editorial duration)
				'left': ((segmentLineItem.renderedInPoint || 0) * this.props.timeScale).toString() + 'px',
				'width': ((segmentLineItem.duration || segmentLineItem.renderedDuration || segmentLineItem.expectedDuration) * this.props.timeScale).toString() + 'px'
			}
		}
	}

	itemClick = (e: any) => {
		this.props.onFollowLiveLine && this.props.onFollowLiveLine(false, e)
	}

	render () {
		return (
			<div className={ClassNames('segment-timeline__layer-item', {
				'audio': this.props.layer.type === RundownAPI.SourceLayerType.AUDIO,
				'cam': this.props.layer.type === RundownAPI.SourceLayerType.CAMERA,
				'cam-movement': this.props.layer.type === RundownAPI.SourceLayerType.CAMERA_MOVEMENT,
				'gfx': this.props.layer.type === RundownAPI.SourceLayerType.GRAPHICS,
				'metadata': this.props.layer.type === RundownAPI.SourceLayerType.METADATA,
				'remote': this.props.layer.type === RundownAPI.SourceLayerType.REMOTE,
				'script': this.props.layer.type === RundownAPI.SourceLayerType.SCRIPT,
				'splits': this.props.layer.type === RundownAPI.SourceLayerType.SPLITS,
				'vt': this.props.layer.type === RundownAPI.SourceLayerType.VT,
			})}
				data-mos-id={this.props.segmentLineItem._id}
				onClick={this.itemClick}
				style={this.getItemStyle()}>
				<span className='segment-timeline__layer-item__label'>{this.props.segmentLineItem.name}</span>
			</div>
		)
	}
}
