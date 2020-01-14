import * as React from 'react'
import * as Escape from 'react-escape'
import { withTranslation } from 'react-i18next'
import { ContextMenu, MenuItem } from 'react-contextmenu'
import { Part } from '../../../lib/collections/Parts'
import { Rundown } from '../../../lib/collections/Rundowns'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { RundownUtils } from '../../lib/rundown'
import { IContextMenuContext } from '../RundownView'
import { PartUi } from './SegmentTimelineContainer'
import { SegmentId } from '../../../lib/collections/Segments'

interface IProps {
	onSetNext: (part: Part | undefined, e: any, offset?: number, take?: boolean) => void
	onSetNextSegment: (segmentId: SegmentId | null, e: any) => void
	playlist?: RundownPlaylist
	studioMode: boolean
	contextMenuContext: IContextMenuContext | null
}
interface IState {
}

export const SegmentContextMenu = withTranslation()(class SegmentContextMenu extends React.Component<Translated<IProps>, IState> {
	constructor (props: Translated<IProps>) {
		super(props)
	}

	render () {
		const { t } = this.props

		const part = this.getPartFromContext()
		const timecode = this.getTimePosition()
		const startsAt = this.getPartStartsAt()

		const isCurrentPart = part && this.props.playlist && part.instance._id === this.props.playlist.currentPartInstanceId

		return (
			this.props.studioMode && this.props.playlist && this.props.playlist.active ?
				<Escape to='document'>
					<ContextMenu id='segment-timeline-context-menu'>
						{part && !part.instance.part.invalid && timecode !== null && <React.Fragment>
							{startsAt !== null && <MenuItem onClick={(e) => this.props.onSetNext(part.instance.part, e)} disabled={isCurrentPart}>
								<span dangerouslySetInnerHTML={{ __html: t('Set this part as <strong>Next</strong>') }}></span> ({RundownUtils.formatTimeToShortTime(Math.floor(startsAt / 1000) * 1000)})
							</MenuItem>}
							{(startsAt !== null && part) ? <React.Fragment>
								<MenuItem onClick={(e) => this.onSetAsNextFromHere(part.instance.part, e)} disabled={isCurrentPart}>
									<span dangerouslySetInnerHTML={{ __html: t('Set <strong>Next</strong> Here') }}></span> ({RundownUtils.formatTimeToShortTime(Math.floor((startsAt + timecode) / 1000) * 1000)})
								</MenuItem>
								<MenuItem onClick={(e) => this.onPlayFromHere(part.instance.part, e)} disabled={isCurrentPart}>
									<span dangerouslySetInnerHTML={{ __html: t('Play from Here') }}></span> ({RundownUtils.formatTimeToShortTime(Math.floor((startsAt + timecode) / 1000) * 1000)})
								</MenuItem>
							</React.Fragment> : null}
						</React.Fragment>}
						{part && timecode === null && <React.Fragment>
							<MenuItem onClick={(e) => this.props.onSetNext(part.instance.part, e)} disabled={isCurrentPart}>
								<span dangerouslySetInnerHTML={{ __html: t('Set segment as <strong>Next</strong>') }}></span>
							</MenuItem>
							{part.instance.segmentId !== this.props.playlist.nextSegmentId ?
								<MenuItem onClick={(e) => this.props.onSetNextSegment(part.instance.segmentId, e)}>
									<span>{t('Queue segment')}</span>
								</MenuItem> :
								<MenuItem onClick={(e) => this.props.onSetNextSegment(null, e)}>
									<span>{t('Clear queued segment')}</span>
								</MenuItem>
							}
						</React.Fragment>}
					</ContextMenu>
				</Escape>
				: null
		)
	}

	getPartFromContext = (): PartUi | null => {
		if (this.props.contextMenuContext && this.props.contextMenuContext.part) {
			return this.props.contextMenuContext.part
		} else {
			return null
		}
	}

	onSetAsNextFromHere = (part: Part, e) => {
		let offset = this.getTimePosition()
		this.props.onSetNext(part, e, offset || 0)
	}

	onPlayFromHere = (part: Part, e) => {
		let offset = this.getTimePosition()
		this.props.onSetNext(part, e, offset || 0, true)
	}

	private getPartStartsAt = (): number | null => {
		if (this.props.contextMenuContext && this.props.contextMenuContext.partStartsAt !== undefined) {
			return this.props.contextMenuContext.partStartsAt
		}
		return null
	}

	private getTimePosition = (): number | null => {
		let offset = 0
		if (this.props.contextMenuContext && this.props.contextMenuContext.partDocumentOffset) {
			const left = this.props.contextMenuContext.partDocumentOffset.left || 0
			const timeScale = this.props.contextMenuContext.timeScale || 1
			const menuPosition = this.props.contextMenuContext.mousePosition || { left }
			offset = (menuPosition.left - left) / timeScale
			return offset
		}
		return null
	}
})
