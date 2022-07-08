import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import { literal } from '@sofie-automation/corelib/dist/lib'
import classNames from 'classnames'
import React, { useCallback, useState } from 'react'
import { ISourceLayerExtended, PartExtended } from '../../../lib/Rundown'
import { contextMenuHoldToDisplayTime } from '../../lib/lib'
import { RundownUtils } from '../../lib/rundown'
import { getElementDocumentOffset } from '../../utils/positions'
import { IContextMenuContext } from '../RundownView'
import { SegmentUi } from '../SegmentContainer/withResolvedSegment'
import { SegmentTimelinePartElementId } from '../SegmentTimeline/Parts/SegmentTimelinePart'
import { LinePartPieceIndicators } from './LinePartPieceIndicators'
import { LinePartTimeline } from './LinePartTimeline'

interface IProps {
	segment: SegmentUi
	part: PartExtended
	isLivePart: boolean
	isNextPart: boolean
	isSinglePartInSegment: boolean
	hasAlreadyPlayed: boolean
	// isLastSegment?: boolean
	// isLastPartInSegment?: boolean
	// isPlaylistLooping?: boolean
	indicatorColumns: Record<string, ISourceLayerExtended[]>
	doesPlaylistHaveNextPart?: boolean
	inHold: boolean
	currentPartWillAutonext: boolean
	// subscriptionsReady: boolean
	displayLiveLineCounter: boolean
	style?: React.CSSProperties
	onContextMenu?: (contextMenuContext: IContextMenuContext) => void
}

export const LinePart: React.FC<IProps> = function LinePart({
	part,
	segment,
	isNextPart,
	isLivePart,
	isSinglePartInSegment,
	hasAlreadyPlayed,
	currentPartWillAutonext,
	indicatorColumns,
	onContextMenu,
}) {
	const isFinished = (part.instance.timings?.stoppedPlayback ?? part.instance.timings?.takeOut) !== undefined
	const [highlight] = useState(false)

	const getPartContext = useCallback(() => {
		const partElement = document.querySelector('#' + SegmentTimelinePartElementId + part.instance._id)
		const partDocumentOffset = getElementDocumentOffset(partElement)

		const ctx = literal<IContextMenuContext>({
			segment: segment,
			part: part,
			partDocumentOffset: partDocumentOffset || undefined,
			timeScale: 1,
			mousePosition: { top: 0, left: 0 },
			partStartsAt: 100,
		})

		if (onContextMenu && typeof onContextMenu === 'function') {
			onContextMenu(ctx)
		}

		return ctx
	}, [segment, part, onContextMenu])

	return (
		<ContextMenuTrigger
			id="segment-timeline-context-menu"
			attributes={{
				className: classNames('segment-opl__part', {
					'invert-flash': highlight,
					'segment-opl__part--next': isNextPart,
					'segment-opl__part--live': isLivePart,
					'segment-opl__part--has-played': hasAlreadyPlayed,
					'segment-opl__part--invalid': part.instance.part.invalid,
				}),
				//@ts-ignore A Data attribue is perfectly fine
				'data-part-instance-id': part.instance._id,
				id: SegmentTimelinePartElementId + part.instance._id,
				role: 'region',
				'aria-roledescription': 'part',
				'aria-label': part.instance.part.title,
			}}
			holdToDisplay={contextMenuHoldToDisplayTime()}
			collect={getPartContext}
		>
			<div className="segment-opl__part-header">
				{isLivePart && <div className="segment-opl__part-marker segment-opl__part-marker--live"></div>}
				{isNextPart && <div className="segment-opl__part-marker segment-opl__part-marker--next"></div>}
				<div className="segment-opl__part-duration">
					{/* <PartDisplayDuration part={part} fixed={true} /> */}
					{part.instance.part.expectedDuration !== undefined &&
						part.instance.part.expectedDuration > 0 &&
						!isSinglePartInSegment && (
							<span role="timer">
								{RundownUtils.formatDiffToTimecode(
									part.instance.part.expectedDuration,
									false,
									false,
									true,
									false,
									true,
									'+'
								)}
							</span>
						)}
					{part.instance.part.expectedDuration === 0 && <span>⋯</span>}
				</div>
				<h3 className="segment-opl__part-title">
					<span>{part.instance.part.title}</span>
				</h3>
			</div>
			<LinePartPieceIndicators pieces={part.pieces} indicatorColumns={indicatorColumns} />
			<LinePartTimeline
				part={part}
				isLive={isLivePart}
				isNext={isNextPart}
				isFinished={isFinished}
				currentPartWillAutonext={currentPartWillAutonext}
			/>
		</ContextMenuTrigger>
	)
}
