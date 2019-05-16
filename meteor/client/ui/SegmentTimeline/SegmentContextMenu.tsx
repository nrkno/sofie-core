import * as React from 'react'
import * as Escape from 'react-escape'
import { translate } from 'react-i18next'
import { ContextMenu, MenuItem } from 'react-contextmenu'
import { SegmentLine } from '../../../lib/collections/SegmentLines'
import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { RundownUtils } from '../../lib/rundown'

interface IProps {
	onSetNext: (segmentLine: SegmentLine | undefined, e: any, offset?: number, take?: boolean) => void
	runningOrder?: RunningOrder
	studioMode: boolean
	contextMenuContext: any
}
interface IState {
}

export const SegmentContextMenu = translate()(class extends React.Component<Translated<IProps>, IState> {
	constructor (props: Translated<IProps>) {
		super(props)
	}

	render () {
		const { t } = this.props

		const segLine = this.getSegmentLineFromContext()
		const timecode = this.getTimePosition()
		const startsAt = this.getSLStartsAt()

		return (
			this.props.studioMode && this.props.runningOrder && this.props.runningOrder.active ?
				<Escape to='document'>
					<ContextMenu id='segment-timeline-context-menu'>
						{segLine && !segLine.invalid && timecode !== null && <React.Fragment>
							{startsAt !== null && <MenuItem onClick={(e) => this.props.onSetNext(segLine, e)} disabled={segLine._id === this.props.runningOrder.currentSegmentLineId}>
								<span dangerouslySetInnerHTML={{ __html: t('Set this part as <strong>Next</strong>') }}></span> ({RundownUtils.formatTimeToShortTime(Math.floor(startsAt / 1000) * 1000)})
							</MenuItem>}
							{(startsAt !== null && segLine) ? <React.Fragment>
								<MenuItem onClick={(e) => this.onSetAsNextFromHere(segLine, e)} disabled={segLine._id === this.props.runningOrder.currentSegmentLineId}>
									<span dangerouslySetInnerHTML={{ __html: t('Set <strong>Next</strong> Here') }}></span> ({RundownUtils.formatTimeToShortTime(Math.floor((startsAt + timecode) / 1000) * 1000)})
								</MenuItem>
								<MenuItem onClick={(e) => this.onPlayFromHere(segLine, e)} disabled={segLine._id === this.props.runningOrder.currentSegmentLineId}>
									<span dangerouslySetInnerHTML={{ __html: t('Play from Here') }}></span> ({RundownUtils.formatTimeToShortTime(Math.floor(timecode / 1000) * 1000)})
								</MenuItem>
							</React.Fragment> : null}
						</React.Fragment>}
						{segLine && timecode === null && <MenuItem onClick={(e) => this.props.onSetNext(segLine, e)} disabled={segLine._id === this.props.runningOrder.currentSegmentLineId}>
							<span dangerouslySetInnerHTML={{ __html: t('Set segment as <strong>Next</strong>') }}></span>
						</MenuItem>}
					</ContextMenu>
				</Escape>
				: null
		)
	}

	getSegmentLineFromContext = (): SegmentLine | null => {
		if (this.props.contextMenuContext && this.props.contextMenuContext.segmentLine) {
			return this.props.contextMenuContext.segmentLine
		} else {
			return null
		}
	}

	onSetAsNextFromHere = (segLine, e) => {
		let offset = this.getTimePosition()
		this.props.onSetNext(segLine, e, offset || 0)
	}

	onPlayFromHere = (segLine, e) => {
		let offset = this.getTimePosition()
		this.props.onSetNext(segLine, e, offset || 0, true)
	}

	private getSLStartsAt = (): number | null => {
		if (this.props.contextMenuContext && this.props.contextMenuContext.segmentLineStartsAt !== undefined) {
			return this.props.contextMenuContext.segmentLineStartsAt
		}
		return null
	}

	private getTimePosition = (): number | null => {
		let offset = 0
		if (this.props.contextMenuContext && this.props.contextMenuContext.segmentLineDocumentOffset) {
			const left = this.props.contextMenuContext.segmentLineDocumentOffset.left || 0
			const timeScale = this.props.contextMenuContext.timeScale || 1
			const menuPosition = this.props.contextMenuContext.mousePosition || { left }
			offset = (menuPosition.left - left) / timeScale
			return offset
		}
		return null
	}
})
