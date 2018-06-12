import * as React from 'react'

import { ISourceLayerUi, IOutputLayerUi, SegmentUi, SegmentLineUi, SegmentLineItemUi } from '../SegmentTimelineContainer'

import { FloatingInspector } from '../../FloatingInspector'

import * as ClassNames from 'classnames'

export interface ISourceLayerItemProps {
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

	render () {
		return this.props.children
	}
}
