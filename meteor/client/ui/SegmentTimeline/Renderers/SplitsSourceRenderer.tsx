import * as React from 'react'

import { FloatingInspector } from '../../FloatingInspector'

import * as ClassNames from 'classnames'
import { CustomLayerItemRenderer, ISourceLayerItemProps } from './CustomLayerItemRenderer'

import { faPlay } from '@fortawesome/fontawesome-free-solid'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

import { RundownAPI } from '../../../../lib/api/rundown'
import { literal } from '../../../../lib/lib'

export enum SplitRole {
	ART = 0,
	BOX = 1
}

interface SplitSubItem {
	_id: string
	type: RundownAPI.SourceLayerType
	// TODO: To be replaced with the structure used by the Core
	role: SplitRole
	content?: any
}

export class SplitsSourceRenderer extends CustomLayerItemRenderer {
	subItems: Array<SplitSubItem>
	leftLabel: HTMLSpanElement
	rightLabel: HTMLSpanElement

	constructor (props) {
		super(props)

		this.subItems = this.rebuildSubItems()
	}

	componentWillUpdate () {
		this.subItems = this.rebuildSubItems()
	}

	setLeftLabelRef = (e: HTMLSpanElement) => {
		this.leftLabel = e
	}

	setRightLabelRef = (e: HTMLSpanElement) => {
		this.rightLabel = e
	}

	updateAnchoredElsWidths = () => {
		let leftLabelWidth = $(this.leftLabel).width() || 0
		let rightLabelWidth = $(this.rightLabel).width() || 0

		this.setAnchoredElsWidths(leftLabelWidth, rightLabelWidth)
	}

	componentDidUpdate (prevProps: Readonly<ISourceLayerItemProps>, prevState: Readonly<any>) {
		if (super.componentDidUpdate && typeof super.componentDidUpdate === 'function') {
			super.componentDidUpdate(prevProps, prevState)
		}

		if (this.props.segmentLineItem.name !== prevProps.segmentLineItem.name) {
			this.updateAnchoredElsWidths()
		}
	}

	rebuildSubItems = () => {
		return [
			literal<SplitSubItem>({
				_id: 'subItem0',
				type: RundownAPI.SourceLayerType.VT,
				role: SplitRole.ART
			}),
			literal<SplitSubItem>({
				_id: 'subItem1',
				type: RundownAPI.SourceLayerType.CAMERA,
				role: SplitRole.BOX,
				content: {
					x: 0.25,
					y: 0.5,
					scale: 0.5
				}
			}),
			literal<SplitSubItem>({
				_id: 'subItem2',
				type: RundownAPI.SourceLayerType.REMOTE,
				role: SplitRole.BOX,
				content: {
					x: 0.75,
					y: 0.5,
					scale: 0.5
				}
			}),
		]
	}

	renderSubItems () {
		return this.subItems.map((item) => {
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

	renderSplitPreview () {
		return (
			<div className='video-preview'>
				{
					this.subItems.map((item) => {
						return (
							<div className={ClassNames('video-preview', {
								'background': item.role === SplitRole.ART,
								'box': item.role === SplitRole.BOX
							}, {
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
							})}
							key={item._id + '-preview'}
							style={{
								'left': ((item.content && item.content.x) * 100).toString() + '%',
								'top': ((item.content && item.content.y) * 100).toString() + '%',
								'width': ((item.content && item.content.scale) * 100).toString() + '%',
								'height': ((item.content && item.content.scale) * 100).toString() + '%'
							}}>

							</div>
						)
					})
				}
			</div>
		)
	}

	render () {
		let labelItems = this.props.segmentLineItem.name.split('||')
		let begin = labelItems[0] || ''
		let end = labelItems[1] || ''

		return [
			<div className='segment-timeline__layer-item__preview' key={this.props.segmentLineItem._id + '-inside-layers'}>
				{this.renderSubItems()}
			</div>,
			<span className='segment-timeline__layer-item__label first-words overflow-label' ref={this.setLeftLabelRef} key={this.props.segmentLineItem._id + '-start'} style={this.getItemLabelOffsetLeft()}>
				{begin}
			</span>,
			<span className='segment-timeline__layer-item__label last-words' ref={this.setRightLabelRef} key={this.props.segmentLineItem._id + '-finish'} style={this.getItemLabelOffsetRight()}>
				<span className='segment-timeline__layer-item__label'>{end}</span>
				{(this.props.segmentLineItem.expectedDuration === 0) &&
					(<div className='segment-timeline__layer-item__label label-icon label-infinite-icon'>
						<FontAwesomeIcon icon={faPlay} />
					</div>)
				}
			</span>,
			<FloatingInspector key={this.props.segmentLineItem._id + '-inspector'} shown={this.props.showMiniInspector && this.props.itemElement !== undefined}>
				<div className='segment-timeline__mini-inspector segment-timeline__mini-inspector--video' style={this.getFloatingInspectorStyle()}>
					{this.renderSplitPreview()}
				</div>
			</FloatingInspector>
		]
	}
}
