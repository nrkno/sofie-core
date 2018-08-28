import * as React from 'react'

import { ISourceLayerUi, IOutputLayerUi, SegmentUi, SegmentLineUi, SegmentLineItemUi } from '../SegmentTimelineContainer'

import { RundownUtils } from '../../../lib/rundown'
import { VTContent, SegmentLineItemLifespan } from '../../../../lib/collections/SegmentLineItems'
import { FloatingInspector } from '../../FloatingInspector'
import { StudioInstallation } from '../../../../lib/collections/StudioInstallations'

import * as ClassNames from 'classnames'

export interface ISourceLayerItemProps {
	mediaPreviewUrl?: string
	typeClass?: string
	layer: ISourceLayerUi
	outputLayer: IOutputLayerUi
	segment: SegmentUi
	segmentLine: SegmentLineUi
	segmentLineDuration?: number
	segmentLineItem: SegmentLineItemUi
	timeScale: number
	onFollowLiveLine?: (state: boolean, event: any) => void
	relative?: boolean
	followLiveLine: boolean
	liveLineHistorySize: number
	livePosition: number | null
	showMiniInspector: boolean
	itemElement: HTMLDivElement
	elementPosition: JQueryCoordinates
	cursorPosition: JQueryCoordinates
	cursorTimePostion: number
	getItemLabelOffsetLeft?: () => {[key: string]: string}
	getItemLabelOffsetRight?: () => { [key: string]: string }
	getItemDuration?: () => number
	setAnchoredElsWidths?: (rightAnchoredWidth: number, leftAnchoredWidth: number) => void
}

export class CustomLayerItemRenderer<IProps = any, IState = any> extends React.Component<ISourceLayerItemProps & IProps, IState> {
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
		return (this.props.segmentLineDuration! || 0)
	}

	setAnchoredElsWidths (leftAnchoredWidth: number, rightAnchoredWidth: number): void {
		if (this.props.setAnchoredElsWidths && typeof this.props.setAnchoredElsWidths === 'function') {
			return this.props.setAnchoredElsWidths(leftAnchoredWidth, rightAnchoredWidth)
		}
	}

	renderOverflowTimeLabel () {
		const vtContent = this.props.segmentLineItem.content as VTContent
		if (!this.props.segmentLineItem.duration && this.props.segmentLineItem.content && vtContent.sourceDuration && (this.props.segmentLineItem.renderedInPoint! + vtContent.sourceDuration) > this.props.segmentLineDuration) {
			let time = this.props.segmentLineItem.renderedInPoint! + vtContent.sourceDuration - ((this.props.segmentLineDuration || 0) as number)
			// only display differences greater than 1 second
			return (time > 0) ? (
				<div className='segment-timeline__layer-item__label label-overflow-time'>
					{RundownUtils.formatDiffToTimecode(time, true, false, true)}
				</div>
			) : null
		}
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
