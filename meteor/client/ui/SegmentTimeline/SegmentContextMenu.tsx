import * as React from 'react'
import * as $ from 'jquery'
import { translate } from 'react-i18next'
import { ContextMenu, MenuItem } from 'react-contextmenu'
import { SegmentLine } from '../../../lib/collections/SegmentLines'
import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'

interface IProps {
	onSetNext: (segmentLine: SegmentLine | undefined, e: any, offset?: number) => void
	runningOrder?: RunningOrder
	studioMode: boolean
	contextMenuContext: any
}
interface IState {
}

export const SegmentContextMenu = translate()(class extends React.Component<Translated<IProps>, IState> {
	getSegmentLineFromContext = () => {
		if (this.props.contextMenuContext && this.props.contextMenuContext.segmentLine) {
			return this.props.contextMenuContext.segmentLine
		} else {
			return null
		}
	}

	onSetAsNextFromHere = (segLine, e) => {
		let offset = 0
		if (this.props.contextMenuContext && this.props.contextMenuContext.segmentLineDocumentOffset) {
			const left = this.props.contextMenuContext.segmentLineDocumentOffset.left || 0
			const timeScale = this.props.contextMenuContext.timeScale || 1
			const menuPosition = $('.react-contextmenu.react-contextmenu--visible').offset() || { left }
			offset = (menuPosition.left - left) / timeScale
		}
		this.props.onSetNext(segLine, e, offset)
	}

	render () {
		const { t } = this.props

		const segLine = this.getSegmentLineFromContext() as SegmentLine || {}

		return (
			this.props.studioMode && this.props.runningOrder && this.props.runningOrder.active ?
				<ContextMenu id='segment-timeline-context-menu'>
					<MenuItem onClick={(e) => this.props.onSetNext(segLine, e)} disabled={segLine._id === this.props.runningOrder.currentSegmentLineId}>
							{t('Set as Next')}
					</MenuItem>
					<MenuItem onClick={(e) => this.onSetAsNextFromHere(segLine, e)} disabled={segLine._id === this.props.runningOrder.currentSegmentLineId}>
							{t('Set as Next from here')}
					</MenuItem>
				</ContextMenu>
				: null
		)
	}
})
