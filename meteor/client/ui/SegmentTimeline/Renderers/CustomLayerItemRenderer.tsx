import * as React from 'react'

import {
	ISourceLayerUi,
	IOutputLayerUi,
	SegmentLineUi,
	SegmentLineItemUi
} from '../SegmentTimelineContainer'

import { RundownUtils } from '../../../lib/rundown'
import { SegmentLineItemLifespan, VTContent } from 'tv-automation-sofie-blueprints-integration'

export interface ICustomLayerItemProps {
	mediaPreviewUrl?: string
	typeClass?: string
	layer: ISourceLayerUi
	outputLayer: IOutputLayerUi
	segmentLine: SegmentLineUi
	segmentLineDuration: number // 0 if unknown
	segmentLineItem: SegmentLineItemUi
	timeScale: number
	onFollowLiveLine?: (state: boolean, event: any) => void
	relative?: boolean
	followLiveLine: boolean
	liveLineHistorySize: number
	livePosition: number | null
	showMiniInspector: boolean
	itemElement: HTMLDivElement | null
	elementPosition: JQueryCoordinates
	cursorPosition: JQueryCoordinates
	cursorTimePosition: number
	getItemLabelOffsetLeft?: () => {[key: string]: string}
	getItemLabelOffsetRight?: () => { [key: string]: string }
	getItemDuration?: () => number
	setAnchoredElsWidths?: (rightAnchoredWidth: number, leftAnchoredWidth: number) => void
}
export interface ISourceLayerItemState {
}

export class CustomLayerItemRenderer<IProps extends ICustomLayerItemProps, IState extends ISourceLayerItemState> extends React.Component<ICustomLayerItemProps & IProps, ISourceLayerItemState & IState> {
	getItemLabelOffsetLeft (): { [key: string]: string } {
		if (this.props.getItemLabelOffsetLeft && typeof this.props.getItemLabelOffsetLeft === 'function') {
			return this.props.getItemLabelOffsetLeft()
		} else {
			return {}
		}
	}

	getItemLabelOffsetRight (): { [key: string]: string } {
		if (this.props.getItemLabelOffsetRight && typeof this.props.getItemLabelOffsetRight === 'function') {
			return this.props.getItemLabelOffsetRight()
		} else {
			return {}
		}
	}

	getFloatingInspectorStyle (): {
		[key: string]: string
	} {
		return {
			'left': (this.props.elementPosition.left + this.props.cursorPosition.left).toString() + 'px',
			'top': this.props.elementPosition.top + 'px'
		}
	}

	getItemDuration (): number {
		if (typeof this.props.getItemDuration === 'function') {
			return this.props.getItemDuration()
		}
		return this.props.segmentLineDuration
	}

	setAnchoredElsWidths (leftAnchoredWidth: number, rightAnchoredWidth: number): void {
		if (this.props.setAnchoredElsWidths && typeof this.props.setAnchoredElsWidths === 'function') {
			return this.props.setAnchoredElsWidths(leftAnchoredWidth, rightAnchoredWidth)
		}
	}

	renderOverflowTimeLabel () {
		const vtContent = this.props.segmentLineItem.content as VTContent
		if (!this.props.segmentLineItem.duration && this.props.segmentLineItem.content && vtContent.sourceDuration && ((this.props.segmentLineItem.renderedInPoint || 0) + vtContent.sourceDuration) > (this.props.segmentLineDuration || 0)) {
			let time = (this.props.segmentLineItem.renderedInPoint || 0) + vtContent.sourceDuration - ((this.props.segmentLineDuration || 0) as number)
			// only display differences greater than 1 second
			return (time > 0) ? (
				<div className='segment-timeline__layer-item__label label-overflow-time'>
					{RundownUtils.formatDiffToTimecode(time, true, false, true)}
				</div>
			) : null
		}
	}

	renderInfiniteItemContentEnded () {
		const content = this.props.segmentLineItem.content as VTContent
		const seek = content && content.seek ? content.seek : 0
		if (this.props.segmentLineItem.infiniteMode && content && content.sourceDuration && (this.props.segmentLineItem.renderedInPoint || 0) + (content.sourceDuration - seek) < (this.props.segmentLineDuration || 0)) {
			return <div className='segment-timeline__layer-item__source-finished' style={{'left': ((content.sourceDuration - seek) * this.props.timeScale).toString() + 'px'}}></div>
		}
		return null
	}

	renderInfiniteIcon () {
		return (this.props.segmentLineItem.infiniteMode && this.props.segmentLineItem.infiniteMode === SegmentLineItemLifespan.Infinite && !this.props.segmentLineItem.duration && !this.props.segmentLineItem.durationOverride) ?
			<div className='segment-timeline__layer-item__label label-icon label-infinite-icon'>
				<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='#ffff00' viewBox='0 0 8 8'>
  					<path d='M2 0c-1.31 0-2 1.01-2 2s.69 2 2 2c.79 0 1.42-.56 2-1.22.58.66 1.19 1.22 2 1.22 1.31 0 2-1.01 2-2s-.69-2-2-2c-.81 0-1.42.56-2 1.22-.58-.66-1.21-1.22-2-1.22zm0 1c.42 0 .88.47 1.34 1-.46.53-.92 1-1.34 1-.74 0-1-.54-1-1 0-.46.26-1 1-1zm4 0c.74 0 1 .54 1 1 0 .46-.26 1-1 1-.43 0-.89-.47-1.34-1 .46-.53.91-1 1.34-1z'
  						transform='translate(0 2)' />
				</svg>
			</div>
			: null
	}

	render () {
		return this.props.children
	}
}
