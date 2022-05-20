import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import { literal } from '@sofie-automation/corelib/dist/lib'
import classNames from 'classnames'
import React, { useCallback, useState } from 'react'
import { PartExtended } from '../../../lib/Rundown'
import { contextMenuHoldToDisplayTime } from '../../lib/lib'
import { getElementDocumentOffset } from '../../utils/positions'
import { IContextMenuContext } from '../RundownView'
import { PartDisplayDuration } from '../RundownView/RundownTiming/PartDuration'
import { IOutputLayerUi, SegmentUi } from '../SegmentContainer/withResolvedSegment'
import { SegmentTimelinePartElementId } from '../SegmentTimeline/Parts/SegmentTimelinePart'
import { LinePartPieceIcons } from './LinePartPieceIcons'
import { LinePartTimeline } from './LinePartTimeline'

interface IProps {
	segment: SegmentUi
	part: PartExtended
	outputLayers: Record<string, IOutputLayerUi>
	isLivePart: boolean
	isNextPart: boolean
	// isLastSegment?: boolean
	// isLastPartInSegment?: boolean
	// isPlaylistLooping?: boolean
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
	currentPartWillAutonext,
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
					'segment-opl__part--invalid': part.instance.part.invalid,
				}),
				//@ts-ignore A Data attribue is perfectly fine
				'data-layer-id': part.instance._id,
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
					<PartDisplayDuration part={part} />
				</div>
				<h3 className="segment-opl__part-title">{part.instance.part.title}</h3>
			</div>
			<LinePartTimeline
				part={part}
				isLive={isLivePart}
				isNext={isNextPart}
				isFinished={isFinished}
				currentPartWillAutonext={currentPartWillAutonext}
			/>
			<div className="segment-opl__piece-icons">
				<LinePartPieceIcons />
			</div>
		</ContextMenuTrigger>
	)
}
