import * as React from 'react'
import Escape from 'react-escape'
import { withTranslation } from 'react-i18next'
import { ContextMenu, MenuItem } from '@jstarpl/react-contextmenu'
import { Part } from '../../../lib/collections/Parts'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { RundownUtils } from '../../lib/rundown'
import { IContextMenuContext } from '../RundownView'
import { PartUi, SegmentUi } from './SegmentTimelineContainer'
import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'

interface IProps {
	onSetNext: (part: Part | undefined, e: any, offset?: number, take?: boolean) => void
	onSetNextSegment: (segmentId: SegmentId | null, e: any) => void
	playlist?: RundownPlaylist
	studioMode: boolean
	contextMenuContext: IContextMenuContext | null
	enablePlayFromAnywhere: boolean
}
interface IState {}

export const SegmentContextMenu = withTranslation()(
	class SegmentContextMenu extends React.Component<Translated<IProps>, IState> {
		constructor(props: Translated<IProps>) {
			super(props)
		}

		render(): JSX.Element | null {
			const { t } = this.props

			const part = this.getPartFromContext()
			const timecode = this.getTimePosition()
			const startsAt = this.getPartStartsAt()

			const isCurrentPart =
				(part && this.props.playlist && part.instance._id === this.props.playlist.currentPartInstanceId) || undefined

			const canSetAsNext = !!this.props.playlist?.activationId

			return this.props.studioMode && this.props.playlist && this.props.playlist.activationId ? (
				<Escape to="document">
					<ContextMenu id="segment-timeline-context-menu">
						{part && timecode === null && (
							<>
								<MenuItem
									onClick={(e) => this.props.onSetNext(part.instance.part, e)}
									disabled={isCurrentPart || !canSetAsNext}
								>
									<span dangerouslySetInnerHTML={{ __html: t('Set segment as <strong>Next</strong>') }}></span>
								</MenuItem>
								{part.instance.segmentId !== this.props.playlist.nextSegmentId ? (
									<MenuItem
										onClick={(e) => this.props.onSetNextSegment(part.instance.segmentId, e)}
										disabled={!canSetAsNext}
									>
										<span>{t('Queue segment')}</span>
									</MenuItem>
								) : (
									<MenuItem onClick={(e) => this.props.onSetNextSegment(null, e)} disabled={!canSetAsNext}>
										<span>{t('Clear queued segment')}</span>
									</MenuItem>
								)}
								<hr />
							</>
						)}
						{part && !part.instance.part.invalid && timecode !== null && (
							<>
								<MenuItem
									onClick={(e) => this.props.onSetNext(part.instance.part, e)}
									disabled={isCurrentPart || !!part.instance.orphaned || !canSetAsNext}
								>
									<span dangerouslySetInnerHTML={{ __html: t('Set this part as <strong>Next</strong>') }}></span>
									{startsAt !== null &&
										'\u00a0(' + RundownUtils.formatTimeToShortTime(Math.floor(startsAt / 1000) * 1000) + ')'}
								</MenuItem>
								{startsAt !== null && part && this.props.enablePlayFromAnywhere ? (
									<>
										<MenuItem
											onClick={(e) => this.onSetAsNextFromHere(part.instance.part, e)}
											disabled={isCurrentPart || !!part.instance.orphaned || !canSetAsNext}
										>
											<span dangerouslySetInnerHTML={{ __html: t('Set <strong>Next</strong> Here') }}></span> (
											{RundownUtils.formatTimeToShortTime(Math.floor((startsAt + timecode) / 1000) * 1000)})
										</MenuItem>
										<MenuItem
											onClick={(e) => this.onPlayFromHere(part.instance.part, e)}
											disabled={isCurrentPart || !!part.instance.orphaned || !canSetAsNext}
										>
											<span dangerouslySetInnerHTML={{ __html: t('Play from Here') }}></span> (
											{RundownUtils.formatTimeToShortTime(Math.floor((startsAt + timecode) / 1000) * 1000)})
										</MenuItem>
									</>
								) : null}
							</>
						)}
					</ContextMenu>
				</Escape>
			) : null
		}

		getSegmentFromContext = (): SegmentUi | null => {
			if (this.props.contextMenuContext && this.props.contextMenuContext.segment) {
				return this.props.contextMenuContext.segment
			}

			return null
		}

		getPartFromContext = (): PartUi | null => {
			if (this.props.contextMenuContext && this.props.contextMenuContext.part) {
				return this.props.contextMenuContext.part
			} else {
				return null
			}
		}

		onSetAsNextFromHere = (part: Part, e) => {
			const offset = this.getTimePosition()
			this.props.onSetNext(part, e, offset || 0)
		}

		onPlayFromHere = (part: Part, e) => {
			const offset = this.getTimePosition()
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
	}
)
