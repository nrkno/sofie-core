import * as React from 'react'

import { ISourceLayerUi, IOutputLayerUi, SegmentUi, SegmentLineUi, SegmentLineItemUi } from '../SegmentTimelineContainer'

import { RundownUtils } from '../../../lib/rundown'
import { FloatingInspector } from '../../FloatingInspector'
import { StudioInstallation } from '../../../../lib/collections/StudioInstallations'

import * as ClassNames from 'classnames'
import { VTContent } from '../../../../lib/collections/SegmentLineItems';

export interface ISourceLayerItemProps {
	mediaPreviewUrl?: string
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
			return (time > 1000) ? (
				<div className='segment-timeline__layer-item__label label-overflow-time'>
					{RundownUtils.formatDiffToTimecode(time, true, false, true)}
				</div>
			) : null
		}
	}

	renderInfiniteIcon () {
		return (this.props.segmentLineItem.infiniteMode) ?
			<div className='segment-timeline__layer-item__label label-icon label-infinite-icon'>
				◆
			</div>
			: null
	}

	render () {
		return this.props.children
	}
}
