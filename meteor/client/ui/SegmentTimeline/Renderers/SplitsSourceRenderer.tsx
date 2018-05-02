import * as React from 'react'
import * as ReactDOM from 'react-dom'

import { ISourceLayerUi, IOutputLayerUi, SegmentUi, SegmentLineUi, SegmentLineItemUi } from '../SegmentTimelineContainer'

import { FloatingInspector } from '../../FloatingInspector'

import * as ClassNames from 'classnames'
import { CustomLayerItemRenderer } from './CustomLayerItemRenderer'

import { RundownAPI } from '../../../../lib/api/rundown'
import { literal } from '../../../../lib/lib'

interface SplitSubItem {
	_id: string
	type: RundownAPI.SourceLayerType
	content?: object
}

export class SplitsSourceRenderer extends CustomLayerItemRenderer {
	subItems: Array<SplitSubItem>

	constructor (props) {
		super(props)

		this.state = {
			subItems: this.rebuildSubItems()
		}
	}

	componentWillUpdate () {
		this.subItems = this.rebuildSubItems()
	}

	rebuildSubItems = () => {
		return [
			literal<SplitSubItem>({
				_id: 'subItem0',
				type: RundownAPI.SourceLayerType.VT
			}),
			literal<SplitSubItem>({
				_id: 'subItem1',
				type: RundownAPI.SourceLayerType.CAMERA
			}),
			literal<SplitSubItem>({
				_id: 'subItem2',
				type: RundownAPI.SourceLayerType.REMOTE
			}),
		]
	}

	renderSubItems () {
		return this.state.subItems.map((item) => {
			return (
				<div key={'item-' + item._id}
					className={ClassNames('segment-timeline__layer-item__preview__item', {
						'audio': item.type === RundownAPI.SourceLayerType.AUDIO,
						'camera': item.type === RundownAPI.SourceLayerType.CAMERA,
						'camera-movement': item.type === RundownAPI.SourceLayerType.CAMERA_MOVEMENT,
						'graphics': item.type === RundownAPI.SourceLayerType.GRAPHICS,
						'lower-third': item.type === RundownAPI.SourceLayerType.LOWER_THIRD,
						'live-speak': item.type === RundownAPI.SourceLayerType.LIVE_SPEAK,
						'mic': item.type === RundownAPI.SourceLayerType.MIC,
						'metadata': item.type === RundownAPI.SourceLayerType.METADATA,
						'remote': item.type === RundownAPI.SourceLayerType.REMOTE,
						'script': item.type === RundownAPI.SourceLayerType.SCRIPT,
						'splits': item.type === RundownAPI.SourceLayerType.SPLITS,
						'vt': item.type === RundownAPI.SourceLayerType.VT,
					})}>
				</div>
			)
		})
	}

	render () {
		let labelItems = this.props.segmentLineItem.name.split('||')
		let begin = labelItems[0] || ''
		let end = labelItems[1] || ''

		return [
			<div className='segment-timeline__layer-item__preview' key={this.props.segmentLineItem._id + '-inside-layers'}>
				{this.renderSubItems()}
			</div>,
			<FloatingInspector key={this.props.segmentLineItem._id + '-inspector'} shown={this.props.showMiniInspector && this.props.itemElement !== undefined}>
				<div className='segment-timeline__mini-inspector segment-timeline__mini-inspector--video' style={this.getFloatingInspectorStyle()}>
					<div>Name: {begin}</div>
					<div>Title: {end}</div>
				</div>
			</FloatingInspector>
		]
	}
}
