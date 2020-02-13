import * as React from 'react'
import * as Escape from 'react-escape'
import { translate } from 'react-i18next'
import { ContextMenu, MenuItem } from 'react-contextmenu'
import { Part } from '../../../lib/collections/Parts'
import { Rundown } from '../../../lib/collections/Rundowns'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { RundownUtils } from '../../lib/rundown'
import { Segment } from '../../../lib/collections/Segments'
import i18next = require('i18next')

interface IProps {
	onSetNext: (part: Part | undefined, e: any, offset?: number, take?: boolean) => void
	onSetNextSegment: (segmentId: string | null, e: any) => void
	onResyncSegment (segmentId: string, e: any)
	rundown?: Rundown
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

		const segment = this.getSegmentFromContext()
		const part = this.getPartFromContext()
		const timecode = this.getTimePosition()
		const startsAt = this.getSLStartsAt()

		return (
			this.props.studioMode && this.props.rundown && this.props.rundown.active ?
				<Escape to='document'>
					<ContextMenu id='segment-timeline-context-menu'>
						{part && !part.invalid && timecode !== null && <React.Fragment>
							{startsAt !== null && <MenuItem onClick={(e) => this.props.onSetNext(part, e)} disabled={part._id === this.props.rundown.currentPartId}>
								<span dangerouslySetInnerHTML={{ __html: t('Set this part as <strong>Next</strong>') }}></span> ({RundownUtils.formatTimeToShortTime(Math.floor(startsAt / 1000) * 1000)})
							</MenuItem>}
							{(startsAt !== null && part) ? <React.Fragment>
								<MenuItem onClick={(e) => this.onSetAsNextFromHere(part, e)} disabled={part._id === this.props.rundown.currentPartId}>
									<span dangerouslySetInnerHTML={{ __html: t('Set <strong>Next</strong> Here') }}></span> ({RundownUtils.formatTimeToShortTime(Math.floor((startsAt + timecode) / 1000) * 1000)})
								</MenuItem>
								<MenuItem onClick={(e) => this.onPlayFromHere(part, e)} disabled={part._id === this.props.rundown.currentPartId}>
									<span dangerouslySetInnerHTML={{ __html: t('Play from Here') }}></span> ({RundownUtils.formatTimeToShortTime(Math.floor((startsAt + timecode) / 1000) * 1000)})
								</MenuItem>
							</React.Fragment> : null}
						</React.Fragment>}
						{part && timecode === null && <React.Fragment>
							<MenuItem onClick={(e) => this.props.onSetNext(part, e)} disabled={part._id === this.props.rundown.currentPartId}>
								<span dangerouslySetInnerHTML={{ __html: t('Set segment as <strong>Next</strong>') }}></span>
							</MenuItem>
							{part.segmentId !== this.props.rundown.nextSegmentId ?
								<MenuItem onClick={(e) => this.props.onSetNextSegment(part.segmentId, e)}>
									<span>{t('Queue segment')}</span>
								</MenuItem> :
								<MenuItem onClick={(e) => this.props.onSetNextSegment(null, e)}>
									<span>{t('Clear queued segment')}</span>
								</MenuItem>
							}
							{
								this.menuItemResyncSegment(t, segment)
							}
						</React.Fragment>}
					</ContextMenu>
				</Escape>
				: segment && segment.unsynced ?
					<Escape to='document'>
						<ContextMenu id='segment-timeline-context-menu'>
							<React.Fragment>
								{
									this.menuItemResyncSegment(t, segment)
								}
							</React.Fragment>
						</ContextMenu>
					</Escape>
				: null
		)
	}

	menuItemResyncSegment = (t: (key: string | string[], options?: i18next.TranslationOptions<object> | undefined) => any, segment: Segment | null) => {
		if (segment && segment.unsynced) {
			return (
				<MenuItem onClick={(e) => this.props.onResyncSegment(segment._id, e)}>
					<span>{t('Re-Sync segment')}</span>
				</MenuItem>
			)
		}
	}

	getSegmentFromContext = (): Segment | null => {
		if (this.props.contextMenuContext && this.props.contextMenuContext.segment) {
			return this.props.contextMenuContext.segment
		} else {
			return null
		}
	}

	getPartFromContext = (): Part | null => {
		if (this.props.contextMenuContext && this.props.contextMenuContext.part) {
			return this.props.contextMenuContext.part
		} else {
			return null
		}
	}

	onSetAsNextFromHere = (part, e) => {
		let offset = this.getTimePosition()
		this.props.onSetNext(part, e, offset || 0)
	}

	onPlayFromHere = (part, e) => {
		let offset = this.getTimePosition()
		this.props.onSetNext(part, e, offset || 0, true)
	}

	private getSLStartsAt = (): number | null => {
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
