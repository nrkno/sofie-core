import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { translate, InjectedTranslateProps } from 'react-i18next'
import { ContextMenu, MenuItem, ContextMenuTrigger } from 'react-contextmenu'
import { SegmentLine } from '../../../lib/collections/SegmentLines'

interface IPropsHeader {
	onSetNext: (segmentLine: SegmentLine | undefined) => void
	contextMenuContext: any
}
interface IStateHeader {
}

export const SegmentContextMenu = translate()(class extends React.Component<IPropsHeader & InjectedTranslateProps, IStateHeader> {
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
				<MenuItem onClick={(e) => this.props.onSetNext(this.getSegmentLineFromContext())}>
					{t('Set as Next')}
				</MenuItem>
			</ContextMenu>
		)
	}
})
