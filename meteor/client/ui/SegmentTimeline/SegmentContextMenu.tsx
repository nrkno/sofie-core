import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { translate } from 'react-i18next'
import { ContextMenu, MenuItem, ContextMenuTrigger } from 'react-contextmenu'
import { SegmentLine } from '../../../lib/collections/SegmentLines'
import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'

interface IProps {
	onSetNext: (segmentLine: SegmentLine | undefined) => void
	runningOrder?: RunningOrder
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

	render () {
		const { t } = this.props

		return (
			<ContextMenu id='segment-timeline-context-menu'>
				<div className='react-contextmenu-label'>
					{this.props.contextMenuContext && this.props.contextMenuContext.segment && this.props.contextMenuContext.segment.name || t('Unknown segment')}: {this.props.contextMenuContext && this.props.contextMenuContext.segmentLine && this.props.contextMenuContext.segmentLine._rank !== undefined && (t('Line') + ' ' + (this.props.contextMenuContext.segmentLine.slug || this.props.contextMenuContext.segmentLine._id)) || t('Unknown line')}
				</div>
				{
					this.props.runningOrder && this.props.runningOrder.active ?
						<MenuItem onClick={(e) => this.props.onSetNext(this.getSegmentLineFromContext())}>
							{t('Set as Next')}
						</MenuItem>
					: null
				}
			</ContextMenu>
		)
	}
})
